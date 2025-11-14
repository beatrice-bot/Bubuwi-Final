document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app-content');
    const bottomNav = document.querySelector('.bottom-nav');

    // DIUBAH: Pastikan konten utama selalu di atas partikel
    app.style.position = 'relative';
    app.style.zIndex = '100';

    // URL API ANDA (TIDAK DIUBAH)
    const API_URL = "https://bubuwi-pro.netlify.app/api/scrape";
    
    let currentUser = null;
    let currentAnimeData = null;
    let currentEpisodeIndex = 0;
    let slideIndex = 0;
    let slideInterval;
    
    // Variabel untuk menyimpan halaman terakhir (untuk tombol kembali)
    let lastPageContext = { page: 'home', params: {} };

    // --- FUNGSI BARU: Terapkan Tema Waktu (Siang/Malam) ---
    function applyThemeByTime() {
        const symbolContainer = document.getElementById('time-symbol-container');
        if (!symbolContainer) return;

        let hours;
        try {
            // Mengambil jam dalam zona waktu WIB (Asia/Jakarta)
            // 'en-US' digunakan hanya untuk format, timeZone adalah kuncinya
            const wibTime = new Date().toLocaleString('en-US', {
                timeZone: 'Asia/Jakarta',
                hour: '2-digit',
                hour12: false
            });
            hours = parseInt(wibTime);
        } catch (e) {
            // Fallback jika environment tidak mendukung TimeZone (gunakan jam lokal)
            console.warn("Gagal mengambil Tipe Zona WIB, menggunakan waktu lokal.", e);
            hours = new Date().getHours();
        }

        // Jam 6 pagi (6) sampai jam 5 sore (16) adalah SIANG
        const isDayTime = hours >= 6 && hours < 17;
        const body = document.body;
        
        // Hapus awan lama sebelum menambah yang baru
        symbolContainer.querySelectorAll('.cloud').forEach(cloud => cloud.remove());
        
        if (isDayTime) {
            body.classList.remove('night-mode');
            symbolContainer.innerHTML = `
                <i class="fas fa-sun time-symbol"></i> <!-- Simbol Matahari -->
            `;
            // Tambahkan 3 awan cerah
            addClouds(symbolContainer, 3); 
        } else {
            body.classList.add('night-mode');
            symbolContainer.innerHTML = `
                <i class="fas fa-moon time-symbol"></i> <!-- Simbol Bulan -->
            `;
            // Tambahkan 2 awan gelap
            addClouds(symbolContainer, 2);
        }
        
        // Panggil ulang initParticles setelah menentukan tema
        initParticles(isDayTime);
    }
    
    // --- FUNGSI BARU: Tambah Awan ---
    function addClouds(container, count) {
        for (let i = 0; i < count; i++) {
            const cloud = document.createElement('div');
            cloud.classList.add('cloud');
            
            // Posisi awan acak di bagian atas layar
            cloud.style.top = `${Math.random() * 10 + 5}vh`;
            // Mulai dari posisi acak (termasuk di luar layar) untuk ilusi tak terbatas
            cloud.style.left = `${Math.random() * 150 - 50}vw`; 
            cloud.style.opacity = `${Math.random() * 0.3 + 0.5}`;
            // Durasi pergerakan awan (antara 30-60 detik)
            cloud.style.animationDuration = `${Math.random() * 30 + 30}s`; 
            // Delay negatif agar awan tidak muncul bersamaan
            cloud.style.animationDelay = `-${Math.random() * 30}s`; 
            
            container.appendChild(cloud);
        }
    }

    // --- FUNGSI DIUBAH: Inisialisasi Partikel (Lebih Banyak dan Dinamis) ---
    function initParticles(isDayTime) {
        const container = document.getElementById('particle-container');
        if (!container) return;
        
        // Hapus partikel lama
        container.innerHTML = ''; 

        // Partikel LEBIH BANYAK! (Siang: 100 emas, Malam: 150 bintang)
        const particleCount = isDayTime ? 100 : 150; 
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');
            
            const size = Math.random() * 3 + 1; // Ukuran 1px - 4px
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            
            // Posisi awal acak
            particle.style.left = `${Math.random() * 100}vw`;
            particle.style.top = `${Math.random() * 100}vh`; // Mulai dari posisi acak di layar
            
            // Durasi dan delay yang lebih bervariasi
            const duration = Math.random() * 10 + 15; // Durasi 15s - 25s
            const delay = Math.random() * 15; // Delay awal acak
            particle.style.animationDuration = `${duration}s`;
            particle.style.animationDelay = `-${delay}s`; // Delay negatif agar animasi sudah berjalan

            container.appendChild(particle);
        }
        
        // Tambahkan efek Bintang Jatuh (Shooting Stars) hanya di MALAM HARI
        if (!isDayTime) {
            const shootingStarCount = 5; // Jumlah bintang jatuh
            for (let i = 0; i < shootingStarCount; i++) {
                 const star = document.createElement('div');
                 star.classList.add('particle', 'shooting-star');
                 
                 star.style.left = `${Math.random() * 100}vw`;
                 star.style.top = `-${Math.random() * 100}px`; // Mulai sedikit di atas layar
                 
                 const duration = Math.random() * 5 + 3; // Durasi 3s - 8s
                 const delay = Math.random() * 10; // Delay acak
                 star.style.animationDuration = `${duration}s`;
                 star.style.animationDelay = `-${delay}s`;
                 
                 container.appendChild(star);
            }
        }
    }

    // --- SEMUA LOGIKA DI BAWAH INI TIDAK DIUBAH SAMA SEKALI ---
    // --- SAYA HANYA MENGGANTI initParticles() DI BAGIAN BAWAH ---

    // --- Fungsi Fetch Data (TIDAK DIUBAH) ---
    async function fetchData(endpoint, params = {}) {
        const url = new URL(API_URL + endpoint);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Fetch error:", error);
            renderError("Gagal memuat data. Coba lagi nanti.");
            return null;
        }
    }

    // --- Fungsi Render Halaman (TIDAK DIUBAH) ---
    function renderPage(page, content) {
        app.innerHTML = content;
        updateActiveNav(page);
    }

    function renderLoader() {
        app.innerHTML = `
            <div class="loader-container">
                <div class="loader"></div>
            </div>
        `;
    }

    function renderError(message) {
        app.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
    }

    // --- Fungsi Navigasi (TIDAK DIUBAH) ---
    function updateActiveNav(currentPage) {
        document.querySelectorAll('.nav-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === currentPage);
        });
    }

    // --- Fungsi Bantuan URL (TIDAK DIUBAH) ---
    function updateURL(page, params = {}) {
        const url = new URL(window.location);
        url.pathname = page;
        url.search = ''; // Hapus parameter lama
        if (params.id) {
            url.searchParams.set('id', params.id);
        }
        if (params.s) {
            url.searchParams.set('s', params.s);
        }
        window.history.pushState({ page, params }, '', url);
    }

    function getCurrentPage() {
        const path = window.location.pathname;
        return path === '/' ? 'home' : path.substring(1);
    }

    function getURLParams() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const s = params.get('s');
        return { id, s };
    }

    // --- Logika Router (TIDAK DIUBAH) ---
    const router = {
        home: async () => {
            renderLoader();
            const data = await fetchData('/home');
            if (data) {
                renderPage('home', buildHomePage(data));
                startSlider();
                lastPageContext = { page: 'home', params: {} };
            }
        },
        search: async (params = {}) => {
            renderPage('search', buildSearchPage(params.query || ''));
            const searchInput = document.getElementById('search-input');
            if (params.query) {
                searchInput.value = params.query;
                performSearch(params.query);
            }
            // Fokus otomatis ke input pencarian
            searchInput.focus();
        },
        detail: async (params) => {
            if (!params.id) return router.home();
            renderLoader();
            const data = await fetchData('/detail', { id: params.id });
            if (data) {
                currentAnimeData = data; // Simpan data untuk halaman nonton
                renderPage('detail', buildDetailPage(data));
            }
        },
        watch: async (params) => {
            if (!params.id || !currentAnimeData) return router.home();
            const episodeIndex = parseInt(params.episodeIndex, 10);
            currentEpisodeIndex = episodeIndex;
            const episode = currentAnimeData.episodes[episodeIndex];
            if (!episode) return;
            
            renderLoader();
            // Ambil link video (misalnya dari server/scrape)
            // Untuk demo, kita asumsikan link video ada di data
            // const videoData = await fetchData('/watch', { episodeId: episode.id });
            // Ganti dengan link video dummy jika tidak ada
            const videoUrl = episode.videoUrl || "https://dummy.url/video.mp4";
            
            renderPage('watch', buildWatchPage(episode, videoUrl));
        },
        profile: () => {
            renderPage('profile', buildProfilePage());
            setupAuthListener();
        },
        render: (page, params = {}) => {
            updateURL(page, params);
            if (router[page]) {
                router[page](params);
            }
        }
    };

    // --- Fungsi Build HTML (TIDAK DIUBAH) ---
    function buildHomePage(data) {
        return `
            <section class="hero-section">
                <div class="hero-gif-container">
                    <img src="https://i.gifer.com/P4id.gif" alt="Anime Montage" class="hero-gif" loading="lazy">
                </div>
                <h1 class="hero-title">Bubuwi-V3</h1>
                <p class="hero-subtitle">Satu Sentuhan Menuju Dunia Anime</p>
            </section>
            
            ${data.featured ? buildFeaturedSlider(data.featured) : ''}
            
            <section class="search-section">
                <form id="search-form" class="search-bar">
                    <i class="fas fa-search search-icon"></i>
                    <input type="search" id="search-input" class="search-input" placeholder="Cari anime favoritmu...">
                </form>
            </section>
            
            <section class="ongoing-section">
                <h2 class="section-title">Sedang Tayang</h2>
                <div class="anime-grid">
                    ${data.ongoing.map(buildAnimeCard).join('')}
                </div>
            </section>
        `;
    }

    function buildAnimeCard(anime) {
        return `
            <a href="#" class="anime-card" data-id="${anime.id}">
                <div class="anime-card-img-container">
                    <img src="${anime.image}" alt="${anime.title}" class="anime-card-img" loading="lazy">
                    ${anime.badge ? `<span class="anime-card-badge">${anime.badge}</span>` : ''}
                </div>
                <div class="anime-card-info">
                    <h3 class="anime-card-title">${anime.title}</h3>
                </div>
            </a>
        `;
    }

    function buildFeaturedSlider(featured) {
        return `
            <section class="featured-section">
                <div class="slider-wrapper">
                    <div class="slider-container">
                        ${featured.map(item => `
                            <a href="#" class="slider-item" data-id="${item.id}">
                                <img src="${item.image}" alt="${item.title}" class="slider-img" loading="lazy">
                                <div class="slider-caption">
                                    <h3 class="slider-title">${item.title}</h3>
                                </div>
                            </a>
                        `).join('')}
                    </div>
                    <div class="slider-dots">
                        ${featured.map((_, index) => `<span class="slider-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>`).join('')}
                    </div>
                </div>
            </section>
        `;
    }

    function buildSearchPage(query) {
        return `
            <section class="search-page">
                <h1 class="section-title">Pencarian</h1>
                <form id="search-form" class="search-bar">
                    <i class="fas fa-search search-icon"></i>
                    <input type="search" id="search-input" class="search-input" placeholder="Cari anime..." value="${query || ''}">
                </form>
                <div id="search-results" class="search-results-grid">
                    <!-- Hasil pencarian akan dimuat di sini -->
                </div>
            </section>
        `;
    }

    async function performSearch(query) {
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;
        const data = await fetchData('/search', { s: query });
        if (data && data.length > 0) {
            resultsContainer.innerHTML = data.map(buildAnimeCard).join('');
        } else {
            resultsContainer.innerHTML = `<p class="empty-state">Tidak ada hasil untuk "${query}"</p>`;
        }
    }

    function buildDetailPage(anime) {
        return `
            <div class="detail-container">
                <button class="back-button" id="back-btn"><i class="fas fa-arrow-left"></i> Kembali</button>
                <header class="detail-header">
                    <img src="${anime.image}" alt="${anime.title}" class="detail-img">
                    <div class="detail-info">
                        <h1 class="detail-title">${anime.title}</h1>
                        <div class="detail-meta">
                            ${anime.status ? `<span><i class="fas fa-tv"></i> ${anime.status}</span>` : ''}
                            ${anime.rating ? `<span><i class="fas fa-star"></i> ${anime.rating}</span>` : ''}
                        </div>
                        <p class="detail-synopsis">${anime.synopsis || 'Tidak ada sinopsis.'}</p>
                    </div>
                </header>
                <section class="episode-section">
                    <h2 class="section-title">Daftar Episode</h2>
                    <div class="episode-list">
                        ${anime.episodes.map((ep, index) => `
                            <button class="episode-button" data-index="${index}" data-id="${anime.id}">
                                ${ep.title}
                            </button>
                        `).join('')}
                    </div>
                </section>
            </div>
        `;
    }

    function buildWatchPage(episode, videoUrl) {
        const totalEpisodes = currentAnimeData.episodes.length;
        const hasPrev = currentEpisodeIndex > 0;
        const hasNext = currentEpisodeIndex < totalEpisodes - 1;

        return `
            <div class="player-container">
                <div class="video-wrapper">
                    <iframe class="video-player" src="${videoUrl}" frameborder="0" allowfullscreen></iframe>
                </div>
                <div class="video-info">
                    <button class="back-button" id="back-to-detail" data-id="${currentAnimeData.id}">
                        <i class="fas fa-arrow-left"></i> Kembali ke Detail
                    </button>
                    <h1 class="video-title">${currentAnimeData.title} - ${episode.title}</h1>
                    <div class="episode-controls">
                        <button class="episode-nav-btn prev" id="prev-episode" ${!hasPrev ? 'disabled' : ''}>
                            <i class="fas fa-chevron-left"></i> Eps Sebelumnya
                        </button>
                        <button class="episode-nav-btn next" id="next-episode" ${!hasNext ? 'disabled' : ''}>
                            Eps Berikutnya <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    function buildProfilePage() {
        return `
            <section class="profile-section">
                <h1 class="section-title">Profil Pengguna</h1>
                <div class="auth-container" id="auth-ui">
                    <!-- UI Otentikasi akan dirender di sini -->
                </div>
            </section>
        `;
    }

    // --- Logika Auth (TIDAK DIUBAH) ---
    function setupAuthListener() {
        const { auth, onAuthStateChanged } = window.firebaseAuth;
        onAuthStateChanged(auth, user => {
            currentUser = user;
            renderAuthUI();
        });
    }

    function renderAuthUI() {
        const authUI = document.getElementById('auth-ui');
        if (!authUI) return;
        
        if (currentUser) {
            authUI.innerHTML = `
                <img src="${currentUser.photoURL || 'https://i.imgur.com/9uK2OPw.png'}" alt="Foto Profil">
                <p>Selamat datang, ${currentUser.displayName}!</p>
                <button class="logout-btn" id="logout-btn">Keluar</button>
            `;
        } else {
            authUI.innerHTML = `
                <p>Masuk untuk menyimpan progres tontonanmu.</p>
                <button class="google-btn" id="google-login-btn">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google">
                    Masuk dengan Google
                </button>
            `;
        }
    }

    // --- Logika Slider (TIDAK DIUBAH) ---
    function startSlider() {
        const container = document.querySelector('.slider-container');
        const dots = document.querySelectorAll('.slider-dot');
        if (!container || !dots.length) return;

        const itemsCount = dots.length;
        slideIndex = 0;

        function showSlide(index) {
            if (index >= itemsCount) index = 0;
            if (index < 0) index = itemsCount - 1;
            
            container.style.transform = `translateX(-${index * 100}%)`;
            dots.forEach(dot => dot.classList.remove('active'));
            dots[index].classList.add('active');
            slideIndex = index;
        }

        if (slideInterval) clearInterval(slideInterval); // Hapus interval lama
        slideInterval = setInterval(() => {
            showSlide(slideIndex + 1);
        }, 5000); // Ganti slide setiap 5 detik

        dots.forEach(dot => {
            dot.addEventListener('click', () => {
                showSlide(parseInt(dot.dataset.index));
                // Reset interval
                clearInterval(slideInterval);
                slideInterval = setInterval(() => {
                    showSlide(slideIndex + 1);
                }, 5000);
            });
        });
    }
    
    // --- Event Listeners (TIDAK DIUBAH) ---
    app.addEventListener('click', e => {
        // Navigasi ke Detail
        const card = e.target.closest('.anime-card, .slider-item');
        if (card) {
            e.preventDefault();
            if (slideInterval) clearInterval(slideInterval);
            const id = card.dataset.id;
            // Simpan konteks halaman saat ini
            lastPageContext = { page: getCurrentPage(), params: { s: getURLParams().s } };
            router.render('detail', { id });
        }
        
        // Navigasi ke Nonton
        const episodeBtn = e.target.closest('.episode-button');
        if (episodeBtn) {
            e.preventDefault();
            const id = episodeBtn.dataset.id;
            const episodeIndex = parseInt(episodeBtn.dataset.index, 10);
            router.render('watch', { id, episodeIndex });
        }
        
        // Tombol Kembali
        const backBtn = e.target.closest('#back-btn');
        if (backBtn) {
            e.preventDefault();
            // Kembali ke halaman terakhir (home atau search)
            router.render(lastPageContext.page, lastPageContext.params);
        }

        // Tombol Kembali ke Detail (dari Halaman Nonton)
        const backToDetailBtn = e.target.closest('#back-to-detail');
        if (backToDetailBtn) {
            e.preventDefault();
            const id = backToDetailBtn.dataset.id;
            router.render('detail', { id });
        }
        
        // Navigasi Episode (Next/Prev)
        const prevBtn = e.target.closest('#prev-episode');
        if (prevBtn && !prevBtn.disabled) {
            router.render('watch', { id: currentAnimeData.id, episodeIndex: currentEpisodeIndex - 1 });
        }
        
        const nextBtn = e.target.closest('#next-episode');
        if (nextBtn && !nextBtn.disabled) {
            router.render('watch', { id: currentAnimeData.id, episodeIndex: currentEpisodeIndex + 1 });
        }

        // Otentikasi
        const loginBtn = e.target.closest('#google-login-btn');
        if (loginBtn) {
            const { auth, provider, signInWithPopup } = window.firebaseAuth;
            signInWithPopup(auth, provider).catch(error => console.error("Login error:", error));
        }

        const logoutBtn = e.target.closest('#logout-btn');
        if (logoutBtn) {
            const { auth, signOut } = window.firebaseAuth;
            signOut(auth).catch(error => console.error("Logout error:", error));
        }
    });

    app.addEventListener('submit', e => {
        // Handle Search
        if (e.target.id === 'search-form') {
            e.preventDefault();
            const searchInput = document.getElementById('search-input');
            const query = searchInput.value.trim();
            if (query) {
                // Simpan konteks pencarian
                lastPageContext = { page: 'search', params: { s: query } };
                // Jika sudah di halaman pencarian, lakukan pencarian. Jika tidak, pindah.
                if (getCurrentPage() === 'search') {
                    updateURL('search', { s: query });
                    performSearch(query);
                } else {
                    router.render('search', { query });
                }
            }
        }
    });

    bottomNav.addEventListener('click', e => {
        const navButton = e.target.closest('.nav-button');
        if (navButton) {
            if (slideInterval) clearInterval(slideInterval);
            router.render(navButton.dataset.page);
        }
    });

    // Handle browser navigation (TIDAK DIUBAH)
    window.addEventListener('popstate', () => {
        if (slideInterval) clearInterval(slideInterval);
        const page = getCurrentPage();
        const params = getURLParams();
        
        if (page === 'search' && params.s) {
            router.render('search', { query: params.s });
        } else if (page === 'detail' || page === 'watch') {
            // Jika pengguna menekan 'back' dari halaman detail/watch,
            // kembalikan ke konteks halaman terakhir (home/search)
            router.render(lastPageContext.page, lastPageContext.params);
        } else {
            router.render(page);
        }
    });

    // --- INISISALISASI APLIKASI ---
    
    // DIUBAH: Ganti initParticles() lama dengan fungsi tema baru
    applyThemeByTime();
    
    // DITAMBAHKAN: Cek tema setiap 5 menit (300,000 ms)
    setInterval(applyThemeByTime, 300000); 

    // Initialize router (TIDAK DIUBAH)
    const initialPage = getCurrentPage();
    const initialParams = getURLParams();
    
    if (initialPage === 'search' && initialParams.s) {
        router.render('search', { query: initialParams.s });
    } else if (initialPage === 'detail' || initialPage === 'watch') {
        // Jika me-refresh halaman detail, kembalikan ke home
        router.render('home');
    } else {
        router.render(initialPage);
    }
    
    // Set up auth listener jika di halaman profile (atau selalu, tergantung kebutuhan)
    // Jika nav-bottom 'profile' selalu ada, panggil ini di luar router.
    // Jika tidak, biarkan di dalam router.profile
});


