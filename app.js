
document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app-content');
    const bottomNav = document.querySelector('.bottom-nav');

    const API_URL = "https://bubuwi-pro.netlify.app/api/scrape";
    
    let currentUser = null;
    let currentAnimeData = null;
    let currentEpisodeIndex = 0;
    let slideIndex = 0;
    let slideInterval;

    // Initialize Firebase Auth
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
        if (path === '/subscribe') return 'subscribe';
        if (path === '/akun') return 'account';
        if (path.includes('-episode-')) return 'watch';
        if (path.includes('-pilih-episode')) return 'detail';
        
        const params = getURLParams();
        if (params.s) return 'search';
        
        return 'home';
    };

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
            </div>`,

        searchPage: (query, results) => `
            <div class="search-page">
                <div class="page-title">Hasil Pencarian: "${query}"</div>
                <div class="search-results-grid">
                    ${results.map(templates.searchResultCard).join('')}
                </div>
            </div>`,
            
        slideCard: (anime, index) => `
            <div class="slide-card ${index === 0 ? 'active' : ''}" data-link="${anime.link}" data-title="${anime.seriesTitle || anime.title}" data-thumbnail="${anime.thumbnail}">
                <div class="slide-image">
                    <img src="${anime.thumbnail}" alt="${anime.seriesTitle || anime.title}">
                    ${anime.episode ? `<div class="slide-episode-badge">${anime.episode}</div>` : ''}
                </div>
                <div class="slide-content">
                    <h3 class="slide-title">${anime.seriesTitle || anime.title}</h3>
                </div>
            </div>`,
            
        subscribePage: () => {
    const subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '[]');
    return `
        <div class="page-title">Anime Berlangganan</div>
        <div class="subscription-grid">
            ${subscriptions.length > 0 ? 
                subscriptions.map(sub => `
                    <div class="subscription-card" data-title="${sub.title}">
                        <img src="${sub.thumbnail}" alt="${sub.title}">
                        <div class="subscription-info">
                            <h3>${sub.title}</h3>
                        </div>
                    </div>
                `).join('') : 
                '<div class="empty-state"><p>Belum ada anime yang disubscribe</p></div>'
            }
        </div>`;
},
        
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
            </div>`,
            
        animeCard: (anime) => `
            <a href="#" class="anime-card" data-link="${anime.link}" data-title="${anime.seriesTitle || anime.title}" data-thumbnail="${anime.thumbnail}">
                ${anime.episode ? `<div class="episode-badge">${anime.episode}</div>` : ''}
                <img src="${anime.thumbnail}" alt="${anime.seriesTitle || anime.title}">
                <div class="title">${anime.seriesTitle || anime.title}</div>
            </a>`,
            
        searchResultCard: (anime) => `
            <a href="#" class="search-result-card" data-link="${anime.link}" data-title="${anime.title}" data-thumbnail="${anime.thumbnail}">
                <img src="${anime.thumbnail || 'https://via.placeholder.com/200x300'}" alt="${anime.title}">
                <div class="search-result-info">
                    <h3>${anime.title}</h3>
                </div>
            </a>`,
            
        detailPage: (data, title, thumbnail) => {
    const isSubscribed = isAnimeSubscribed(title);
    // Perbaikan kecil di slug Anda, Anda salah ketik `a-z0-n` (seharusnya `a-z0-9`)
    const animeSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '-'); 

    return `
        <div class="fancy-detail-header" style="background-image: url('${thumbnail}')">
            <div class="header-overlay"></div>
            <div class="header-content">
                <img src="${thumbnail}" alt="${title}" class="header-poster">
                <div class="header-info">
                    <h2>${title}</h2>
                    <p>Total Episode: ${data.episodeCount || '?'}</p>
                    <button id="subscribe-btn" class="subscribe-btn ${isSubscribed ? 'subscribed' : ''}">
                        <span class="btn-icon">${isSubscribed ? '✓' : '+'}</span>
                        <span class="btn-text">${isSubscribed ? 'Tersubscribe' : 'Subscribe'}</span>
                    </button>
                </div>
            </div>
        </div>

        <div class="page-title-section">
            <h3 class="section-title">Daftar Episode</h3>
        </div>

        <div class="fancy-episode-list">
            ${(data.episodes || []).map((ep, index) => `
                <a href="#" class="fancy-episode-card" data-link="${ep.link}" data-episode-index="${index}">
                    <div class="ep-icon">
                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <h3 class="ep-title">${ep.title}</h3>
                </a>
            `).join('')}
        </div>`;
},

        
        watchPage: (data, episodeIndex = 0) => {
    const episodes = currentAnimeData?.episodes || [];
    const currentEp = episodes[episodeIndex];
    const hasPrev = episodeIndex > 0;
    const hasNext = episodeIndex < episodes.length - 1;

    return `
        <div class="fancy-watch-container">
            <div class="video-container">
                <iframe src="${data.videoFrames ? data.videoFrames[0] : ''}" allowfullscreen></iframe>
            </div>

            <div class="watch-info-header">
                <button id="back-to-detail" class="back-btn">
                    <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                </button>
                <h2 class="episode-title">${data.title}</h2>
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

            <h3 class="section-title-small">Pilih Episode</h3>
            <div class="fancy-episode-grid">
                <div class="fancy-episode-scroll">
                    ${episodes.map((ep, index) => `
                        <div class="fancy-episode-grid-item ${index === episodeIndex ? 'active' : ''}" data-episode-index="${index}">
                            ${index + 1}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;
},

        
        bottomNav: (activePage) => `
            <button class="nav-button ${activePage === 'home' ? 'active' : ''}" data-page="home">
                <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                <span>Utama</span>
            </button>
            <button class="nav-button ${activePage === 'subscribe' ? 'active' : ''}" data-page="subscribe">
                <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                <span>Subscribe</span>
            </button>
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
                } else if (page === 'subscribe') {
                    updateURL('/subscribe');
                    content = templates.subscribePage();
                } else if (page === 'account') {
                    updateURL('/akun');
                    content = templates.accountPage();
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
            app.innerHTML = '<p class="error-message">Gagal memuat detail anime.</p>';
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
            app.innerHTML = '<p class="error-message">Gagal memuat video.</p>';
        }
    };

    const isAnimeSubscribed = (title) => {
    const subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '[]');
    return subscriptions.some(sub => sub.title === title);
};

    const toggleSubscription = () => {
    if (!currentAnimeData) return false; // Jangan lakukan apa-apa jika data tidak ada

    let subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '[]');
    const title = currentAnimeData.title;
    const existingIndex = subscriptions.findIndex(sub => sub.title === title);

    let isNowSubscribed;
    if (existingIndex > -1) {
        // Unsubscribe: Hapus dari array
        subscriptions.splice(existingIndex, 1);
        isNowSubscribed = false;
    } else {
        // Subscribe: Simpan seluruh data anime yang sedang dilihat
        subscriptions.push(currentAnimeData);
        isNowSubscribed = true;
    }

    localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
    return isNowSubscribed;
};

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

        // Handle subscription cards
const subCard = e.target.closest('.subscription-card');
if (subCard) {
    e.preventDefault();
    const title = subCard.dataset.title;
    const subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '[]');
    const animeData = subscriptions.find(sub => sub.title === title);

    if (animeData) {
        currentAnimeData = animeData; // Set data global
        const animeSlug = animeData.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        updateURL(`/${animeSlug}-pilih-episode`); // Perbarui URL
        app.innerHTML = templates.detailPage(animeData, animeData.title, animeData.thumbnail); // Render halaman detail
    }
    return;
}


        // Handle episode cards
        const epCard = e.target.closest('.episode-card');
        if (epCard) { 
            e.preventDefault(); 
            const episodeIndex = parseInt(epCard.dataset.episodeIndex) || 0;
            handleWatch(epCard.dataset.link, episodeIndex);
            return;
        }

// Handle subscribe button
if (e.target.closest('#subscribe-btn')) {
    e.preventDefault();
    const btn = e.target.closest('#subscribe-btn');

    // Panggil fungsi toggleSubscription baru kita
    const isNowSubscribed = toggleSubscription();

    btn.classList.add('animating');
    setTimeout(() => {
        btn.classList.toggle('subscribed', isNowSubscribed);
        btn.querySelector('.btn-text').textContent = isNowSubscribed ? 'Tersubscribe' : 'Subscribe';
        btn.querySelector('.btn-icon').textContent = isNowSubscribed ? '✓' : '+';
        btn.classList.remove('animating');
    }, 200);
}

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

        // Handle episode navigation - FIXED
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

        // Handle episode grid - FIXED
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
            router.render(navButton.dataset.page);
        }
    });

    // Handle browser navigation
    window.addEventListener('popstate', () => {
        const page = getCurrentPage();
        const params = getURLParams();
        
        if (page === 'search' && params.s) {
            router.render('search', { query: params.s });
        } else {
            router.render(page);
        }
    });

    // Initialize router
    const initialPage = getCurrentPage();
    const initialParams = getURLParams();
    
    if (initialPage === 'search' && initialParams.s) {
        router.render('search', { query: initialParams.s });
    } else {
        router.render(initialPage);
    }
});
