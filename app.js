document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app-content');
    const bottomNav = document.querySelector('.bottom-nav');
    // Gunakan URL API Anda SENDIRI
    const API_URL = "https://bubuwi-pro.netlify.app/api/scrape"; // Ganti dengan URL API Anda

    let currentUser = null;
    let currentAnimeData = null; // Menyimpan data anime saat ini (termasuk daftar episode)
    let currentEpisodeIndex = 0;
    let slideIndex = 0;
    let slideInterval;

    // Initialize Firebase Auth (jika ada)
    if (window.firebaseAuth) {
        window.firebaseAuth.onAuthStateChanged(window.firebaseAuth.auth, (user) => {
            currentUser = user;
            if (router.currentPage === 'account') {
                router.render('account');
            }
        });
    }

    // URL Router
    const updateURL = (path, params = {}) => {
        const url = new URL(window.location);
        url.pathname = path;
        url.search = '';

        Object.keys(params).forEach(key => {
            if (params[key]) url.searchParams.set(key, params[key]);
        });

        window.history.pushState(null, '', url.toString());
    };

    const getURLParams = () => {
        const params = new URLSearchParams(window.location.search);
        return Object.fromEntries(params.entries());
    };

    const getCurrentPage = () => {
        const path = window.location.pathname;
        if (path === '/' || path === '/index') return 'home';
        // Hapus halaman subscribe
        if (path === '/akun') return 'account';
        if (path.includes('-episode-')) return 'watch';
        if (path.includes('-pilih-episode')) return 'detail';

        const params = getURLParams();
        if (params.s) return 'search';

        return 'home';
    };

    // Templates HTML (Memperbarui untuk detail dan watch, hapus subscribe)
    const templates = {
        loader: () => `<div class="loader"><div class="loader-spinner"></div><p>Loading...</p></div>`,

        homePage: (data) => `
            <div class="hero-section">
                <div class="hero-gif-container">
                    <img src="https://files.catbox.moe/03g5k9.gif" alt="Hero Animation" class="hero-gif">
                    <div class="logo-overlay">
                        <img src="https://i.imgur.com/9uK2OPw.png" alt="Bubuwi Logo" class="hero-logo">
                    </div>
                </div>
                <h1 class="hero-title">Bubuwi-V3</h1>
            </div>

            <div class="featured-section">
                <h2 class="section-title">Anime Pilihan</h2>
                <div class="slider-container">
                    <div class="slider-wrapper">
                        <div class="slider-track" id="slider-track">
                            ${(data.results || []).slice(0, 3).map((anime, index) => templates.slideCard(anime, index)).join('')}
                        </div>
                    </div>
                    <div class="slider-dots">
                        ${(data.results || []).slice(0, 3).map((_, index) => `<div class="slider-dot ${index === 0 ? 'active' : ''}" data-slide="${index}"></div>`).join('')}
                    </div>
                </div>
            </div>

            <div class="search-section">
                <div class="search-container">
                    <form id="main-search-form">
                        <input type="search" id="main-search-input" placeholder="Cari anime favorit...">
                        <button type="submit" class="search-btn">
                            <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14z"/></svg>
                        </button>
                    </form>
                </div>
            </div>

            <div class="latest-section">
                <h2 class="section-title">Anime Baru Rilis</h2>
                <div class="anime-grid">${(data.results || []).map(templates.animeCard).join('')}</div>
            </div>
        `,

        searchPage: (query, results) => `
            <div class="search-page">
                <div class="page-title">Hasil Pencarian: "${query}"</div>
                <div class="search-results-grid">
                    ${results.map(templates.searchResultCard).join('')}
                </div>
            </div>
        `,

        // Hapus halaman subscribePage
        // subscribePage: () => { ... },

        accountPage: () => `
            <div class="page-title">Akun</div>
            <div class="account-section">
                ${currentUser ? `
                    <div class="user-profile">
                        <div class="profile-picture">
                            <img src="${currentUser.photoURL}" alt="Profile">
                        </div>
                        <div class="user-info">
                            <h3>${currentUser.displayName}</h3>
                            <p>${currentUser.email}</p>
                        </div>
                        <button id="logout-btn" class="auth-btn logout-btn">Logout</button>
                    </div>
                ` : `
                    <div class="login-section">
                        <button id="google-login-btn" class="google-login-btn">
                            <svg viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            Masuk dengan Google
                        </button>
                    </div>
                `}
            </div>
            <div class="contact-container">
                <div class="contact-title">Kontak Developer</div>
                <div class="contact-page-logo">
                    <img src="https://i.imgur.com/9uK2OPw.png" alt="Logo Bubuwi">
                </div>
                <a href="https://www.instagram.com/adnanmwa" target="_blank" class="contact-link">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" alt="Instagram">
                    <span>@adnanmwa</span>
                </a>
                <a href="https://www.tiktok.com/@adnansagiri" target="_blank" class="contact-link">
                    <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNxuydAoOVzXmO6EXy6vZhaJ17jCGvYKITEzu7BNMYkEaux6HqKvnQax0Q&s=10" alt="TikTok">
                    <span>@adnansagiri</span>
                </a>
            </div>
        `,

        slideCard: (anime, index) => `
            <div class="slide-card ${index === 0 ? 'active' : ''}" data-link="${anime.link}" data-title="${anime.seriesTitle || anime.title}" data-thumbnail="${anime.thumbnail}">
                <div class="slide-image">
                    <img src="${anime.thumbnail}" alt="${anime.seriesTitle || anime.title}">
                    ${anime.episode ? `<div class="slide-episode-badge">${anime.episode}</div>` : ''}
                </div>
                <div class="slide-content">
                    <h3 class="slide-title">${anime.seriesTitle || anime.title}</h3>
                </div>
            </div>
        `,

        animeCard: (anime) => `
            <a href="#" class="anime-card" data-link="${anime.link}" data-title="${anime.seriesTitle || anime.title}" data-thumbnail="${anime.thumbnail}">
                ${anime.episode ? `<div class="episode-badge">${anime.episode}</div>` : ''}
                <img src="${anime.thumbnail}" alt="${anime.seriesTitle || anime.title}">
                <div class="title">${anime.seriesTitle || anime.title}</div>
            </a>
        `,

        searchResultCard: (anime) => `
            <a href="#" class="search-result-card" data-link="${anime.link}" data-title="${anime.title}" data-thumbnail="${anime.thumbnail}">
                <img src="${anime.thumbnail || 'https://via.placeholder.com/200x300'}" alt="${anime.title}">
                <div class="search-result-info">
                    <h3>${anime.title}</h3>
                </div>
            </a>
        `,

        // Detail Page - Kembali ke scraping sederhana
        detailPage: (data, title, thumbnail) => {
            // Gunakan data yang disimpan sebelumnya (currentAnimeData) jika tersedia
            const episodes = currentAnimeData?.episodes || data.episodes || [];
            const episodeCount = currentAnimeData?.episodeCount || data.episodeCount || episodes.length;

            return `
                <div class="detail-header">
                    <img src="${thumbnail}" alt="${title}">
                    <div class="detail-info">
                        <h2>${title}</h2>
                        <p>Total Episode: ${episodeCount}</p>
                        <!-- Hapus tombol subscribe -->
                    </div>
                </div>
                <div class="episode-list">
                    <h3 class="section-title">Daftar Episode</h3>
                    ${episodes.map((ep, index) => `
                        <a href="#" class="episode-card" data-link="${ep.link}" data-episode-index="${index}">
                            <h3>${ep.title}</h3>
                        </a>
                    `).join('')}
                </div>
            `;
        },

        // Watch Page - Kembali ke scraping sederhana
        watchPage: (data, episodeIndex = 0) => {
            const episodes = currentAnimeData?.episodes || [];
            const currentEp = episodes[episodeIndex];
            const hasPrev = episodeIndex > 0;
            const hasNext = episodeIndex < episodes.length - 1;
            const animeTitle = currentAnimeData?.title || 'Anime';

            return `
                <div class="watch-header">
                    <button id="back-to-detail" class="back-btn">
                        <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                        Kembali
                    </button>
                    <h2 class="episode-title">${animeTitle} - Episode ${episodeIndex + 1}</h2>
                </div>
                <div class="video-container">
                    <iframe src="${data.videoFrames ? data.videoFrames[0] : ''}" allowfullscreen></iframe>
                </div>
                <div class="episode-controls">
                    <button id="prev-episode" class="episode-nav-btn ${!hasPrev ? 'disabled' : ''}" ${!hasPrev ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>
                        Prev
                    </button>
                    <button id="next-episode" class="episode-nav-btn ${!hasNext ? 'disabled' : ''}" ${!hasNext ? 'disabled' : ''}>
                        Next
                        <svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
                    </button>
                </div>
                <div class="episode-grid">
                    ${episodes.map((ep, index) => `
                        <div class="episode-grid-item ${index === episodeIndex ? 'active' : ''}" data-episode-index="${index}">
                            ${index + 1}
                        </div>
                    `).join('')}
                </div>
            `;
        },

        // Bottom Nav - Hapus tombol subscribe
        bottomNav: (activePage) => `
            <button class="nav-button ${activePage === 'home' ? 'active' : ''}" data-page="home">
                <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                <span>Utama</span>
            </button>
            <!-- Hapus tombol subscribe -->
            <button class="nav-button ${activePage === 'account' ? 'active' : ''}" data-page="account">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6m0 13c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5Z"/></svg>
                <span>Akun</span>
            </button>`
    };

    const router = {
        currentPage: getCurrentPage(),
        render: async (page, params = {}) => {
            router.currentPage = page;
            app.innerHTML = templates.loader();
            bottomNav.innerHTML = templates.bottomNav(page);

            try {
                let content = '';
                if (page === 'home') {
                    updateURL('/index');
                    const data = await fetch(API_URL).then(res => res.json());
                    if (!data.results || data.results.length === 0) throw new Error("API tidak mengembalikan hasil.");
                    content = templates.homePage(data);
                    setTimeout(initSlider, 100);
                } else if (page === 'search') {
                    const query = params.query || getURLParams().s;
                    updateURL('/', { s: query });
                    const data = await fetch(`${API_URL}?search=${encodeURIComponent(query)}`).then(res => res.json());
                    content = templates.searchPage(query, data.results || []);
                // } else if (page === 'subscribe') { // Hapus bagian ini
                //     updateURL('/subscribe');
                //     content = templates.subscribePage();
                } else if (page === 'account') {
                    updateURL('/akun');
                    content = templates.accountPage();
                } else if (page === 'detail') {
                    // Render detail page jika data sudah ada di currentAnimeData
                    if (currentAnimeData) {
                         content = templates.detailPage(currentAnimeData, currentAnimeData.title, currentAnimeData.thumbnail);
                    } else {
                         app.innerHTML = `<p class="error-message">Data anime tidak ditemukan. Silakan kembali ke halaman utama.</p>`;
                         return;
                    }
                } else if (page === 'watch') {
                    // Render watch page jika data sudah ada
                     if (currentAnimeData) {
                         content = templates.watchPage(currentAnimeData.episodes[currentEpisodeIndex] || {}, currentEpisodeIndex);
                     } else {
                          app.innerHTML = `<p class="error-message">Data episode tidak ditemukan. Silakan kembali ke daftar episode.</p>`;
                          return;
                     }
                }
                app.innerHTML = content;
            } catch (e) {
                app.innerHTML = `<p class="error-message">Gagal memuat. Periksa URL API di app.js atau coba lagi. (${e.message})</p>`;
            }
        }
    };

    const initSlider = () => {
        const track = document.getElementById('slider-track');
        const dots = document.querySelectorAll('.slider-dot');

        if (!track || !dots.length) return;

        const updateSlider = (index) => {
            slideIndex = index;
            track.style.transform = `translateX(-${index * 100}%)`;
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
        };

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => updateSlider(index));
        });

        slideInterval = setInterval(() => {
            slideIndex = (slideIndex + 1) % dots.length;
            updateSlider(slideIndex);
        }, 4000);
    };

    const handleDetail = async (link, title, thumbnail, isFromHome = false) => {
        app.innerHTML = templates.loader();
        let detailLink = link;
        const animeSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        updateURL(`/${animeSlug}-pilih-episode`);

        if (isFromHome) {
            const searchData = await fetch(`${API_URL}?search=${encodeURIComponent(title)}`).then(res => res.json());
            if (searchData.results && searchData.results.length > 0) {
                detailLink = searchData.results[0].link;
            } else {
                app.innerHTML = `<p class="error-message">Gagal menemukan halaman detail untuk ${title}.</p>`;
                return;
            }
        }

        try {
            const data = await fetch(`${API_URL}?animePage=${encodeURIComponent(detailLink)}`).then(res => res.json());
            currentAnimeData = { ...data, title, thumbnail: thumbnail !== 'null' && thumbnail ? thumbnail : data.thumbnail };
            const finalThumbnail = thumbnail !== 'null' && thumbnail ? thumbnail : data.thumbnail;
            app.innerHTML = templates.detailPage(data, title, finalThumbnail);
        } catch (e) {
            app.innerHTML = `<p class="error-message">Gagal memuat detail anime. (${e.message})</p>`;
        }
    };

    const handleWatch = async (link, episodeIndex = 0) => {
        app.innerHTML = templates.loader();
        currentEpisodeIndex = episodeIndex;

        const animeTitle = currentAnimeData?.title || 'anime';
        const animeSlug = animeTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
        updateURL(`/${animeSlug}-episode-${episodeIndex + 1}`);

        try {
            const data = await fetch(`${API_URL}?url=${encodeURIComponent(link)}`).then(res => res.json());
            app.innerHTML = templates.watchPage(data, episodeIndex);
        } catch (e) {
            app.innerHTML = `<p class="error-message">Gagal memuat video. (${e.message})</p>`;
        }
    };

    // Hapus fungsi toggleSubscription dan isAnimeSubscribed

    // Event Listeners
    app.addEventListener('submit', e => {
        if (e.target.id === 'main-search-form') {
            e.preventDefault();
            const query = e.target.querySelector('#main-search-input').value.trim();
            if (query) {
                clearInterval(slideInterval);
                router.render('search', { query });
            }
        }
    });

    app.addEventListener('click', e => {
        // Handle anime/search result cards
        const card = e.target.closest('.anime-card, .search-result-card, .slide-card');
        if (card) {
            e.preventDefault();
            clearInterval(slideInterval);
            const isFromHome = card.classList.contains('anime-card') || card.classList.contains('slide-card');
            handleDetail(card.dataset.link, card.dataset.title, card.dataset.thumbnail, isFromHome);
            return;
        }

        // Hapus event listener untuk subscription card
        // const subCard = e.target.closest('.subscription-card');
        // if (subCard) { ... }

        // Handle episode cards
        const epCard = e.target.closest('.episode-card');
        if (epCard) {
            e.preventDefault();
            const episodeIndex = parseInt(epCard.dataset.episodeIndex) || 0;
            handleWatch(epCard.dataset.link, episodeIndex);
            return;
        }

        // Hapus event listener untuk subscribe button
        // if (e.target.closest('#subscribe-btn')) { ... }

        // Handle Google login
        if (e.target.closest('#google-login-btn')) {
            e.preventDefault();
            if (window.firebaseAuth) {
                window.firebaseAuth.signInWithPopup(window.firebaseAuth.auth, window.firebaseAuth.provider)
                    .catch(error => console.error('Login error:', error));
            }
        }

        // Handle logout
        if (e.target.closest('#logout-btn')) {
            e.preventDefault();
            if (window.firebaseAuth) {
                window.firebaseAuth.signOut(window.firebaseAuth.auth);
            }
        }

        // Handle back to detail
        if (e.target.closest('#back-to-detail')) {
            e.preventDefault();
            if (currentAnimeData) {
                const animeSlug = currentAnimeData.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
                updateURL(`/${animeSlug}-pilih-episode`);
                app.innerHTML = templates.detailPage(currentAnimeData, currentAnimeData.title, currentAnimeData.thumbnail);
            }
        }

        // Handle episode navigation
        if (e.target.closest('#prev-episode') && !e.target.closest('#prev-episode').disabled) {
            e.preventDefault();
            if (currentEpisodeIndex > 0 && currentAnimeData?.episodes) {
                handleWatch(currentAnimeData.episodes[currentEpisodeIndex - 1].link, currentEpisodeIndex - 1);
            }
        }

        if (e.target.closest('#next-episode') && !e.target.closest('#next-episode').disabled) {
            e.preventDefault();
            if (currentEpisodeIndex < (currentAnimeData?.episodes?.length || 0) - 1 && currentAnimeData?.episodes) {
                handleWatch(currentAnimeData.episodes[currentEpisodeIndex + 1].link, currentEpisodeIndex + 1);
            }
        }

        // Handle episode grid
        const gridItem = e.target.closest('.episode-grid-item');
        if (gridItem) {
            e.preventDefault();
            const episodeIndex = parseInt(gridItem.dataset.episodeIndex);
            if (currentAnimeData?.episodes?.[episodeIndex]) {
                handleWatch(currentAnimeData.episodes[episodeIndex].link, episodeIndex);
            }
        }
    });

    bottomNav.addEventListener('click', e => {
        const navButton = e.target.closest('.nav-button');
        if (navButton) {
            clearInterval(slideInterval);
            // Hapus pengecekan untuk halaman 'subscribe'
            if (navButton.dataset.page === 'home' || navButton.dataset.page === 'account') {
                 router.render(navButton.dataset.page);
            } else if (navButton.dataset.page === 'subscribe') {
                 // Arahkan ke halaman utama jika subscribe diklik
                 router.render('home');
            }
        }
    });

    // Handle browser navigation
    window.addEventListener('popstate', () => {
        const page = getCurrentPage();
        const params = getURLParams();

        if (page === 'search' && params.s) {
            router.render('search', { query: params.s });
        } else {
            // Hapus pengecekan untuk halaman 'subscribe'
            if (page === 'home' || page === 'account' || page === 'detail' || page === 'watch') {
                 router.render(page);
            } else {
                 // Arahkan ke halaman utama jika halaman tidak dikenal (termasuk /subscribe)
                 router.render('home');
            }
        }
    });

    // Initialize router
    const initialPage = getCurrentPage();
    const initialParams = getURLParams();

    if (initialPage === 'search' && initialParams.s) {
        router.render('search', { query: initialParams.s });
    } else {
        // Hapus pengecekan untuk halaman 'subscribe'
        if (initialPage === 'home' || initialPage === 'account') {
             router.render(initialPage);
        } else {
             router.render('home'); // Fallback ke home
        }
    }
});
