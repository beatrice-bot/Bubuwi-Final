// --- 1. KONFIGURASI UTAMA ---
const APP_CONFIG = {
    API: {
        BASE_URL: "https://bubuwi-pro.netlify.app/api/scrape",
        TIMEOUT: 10000,
        RETRY_ATTEMPTS: 2,
        CACHE_TTL: 300000, // 5 menit dalam ms
    },
    UI: {
        DEFAULT_THEME: 'dark',
        LOADING_ANIMATION_TYPE: 'spinner',
        SLIDER_AUTOPLAY_INTERVAL: 4000,
        EPISODE_GRID_COLUMNS: 6,
        SUBSCRIPTION_SYNC_INTERVAL: 300000, // 5 menit
    },
    STORAGE: {
        KEYS: {
            SUBSCRIPTIONS: 'bubuwi_subscriptions',
            USER_PREFERENCES: 'bubuwi_user_prefs',
            CACHE: 'bubuwi_api_cache',
            CURRENT_ANIME_DATA: 'bubuwi_current_anime_data',
            CURRENT_EPISODE_INDEX: 'bubuwi_current_episode_index',
        }
    }
};

// --- 2. MANAJEMEN PENYIMPANAN LOKAL ---
class StorageManager {
    static get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error(`Error reading from localStorage with key ${key}:`, e);
            return null;
        }
    }

    static set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`Error writing to localStorage with key ${key}:`, e);
        }
    }

    static remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error(`Error removing from localStorage with key ${key}:`, e);
        }
    }

    static cleanupCache() {
        const cache = this.get(APP_CONFIG.STORAGE.KEYS.CACHE) || {};
        const now = Date.now();
        let cleaned = false;

        for (const [url, cachedData] of Object.entries(cache)) {
            if (now - cachedData.timestamp > APP_CONFIG.API.CACHE_TTL) {
                delete cache[url];
                cleaned = true;
            }
        }

        if (cleaned) {
            this.set(APP_CONFIG.STORAGE.KEYS.CACHE, cache);
        }
    }

    static initialize() {
        this.cleanupCache();
    }
}

StorageManager.initialize();

// --- 3. MANAJEMEN PENYIMPANAN ANIME BERLANGGANANAN ---
class SubscriptionManager {
    constructor() {
        this.subscriptions = StorageManager.get(APP_CONFIG.STORAGE.KEYS.SUBSCRIPTIONS) || [];
    }

    getAll() {
        return this.subscriptions;
    }

    isSubscribed(title) {
        return this.subscriptions.some(sub => sub.title === title);
    }

    async subscribe(title, thumbnail, detailLink, url) {
        if (this.isSubscribed(title)) {
            this.unsubscribe(title);
            return false; // Unsubscribed
        }

        try {
            const fullAnimeData = await this._fetchFullAnimeData(detailLink);
            if (!fullAnimeData) {
                throw new Error("Gagal mengambil data lengkap anime.");
            }

            const subscriptionData = {
                title: title,
                thumbnail: thumbnail,
                url: url,
                detailLink: detailLink,
                episodes: fullAnimeData.episodes || [],
                episodeCount: fullAnimeData.episodes?.length || 0,
                lastUpdated: new Date().toISOString()
            };

            this.subscriptions.push(subscriptionData);
            StorageManager.set(APP_CONFIG.STORAGE.KEYS.SUBSCRIPTIONS, this.subscriptions);
            return true; // Subscribed
        } catch (e) {
            console.error("Gagal menyubscribe anime:", e);
            throw e;
        }
    }

    unsubscribe(title) {
        this.subscriptions = this.subscriptions.filter(sub => sub.title !== title);
        StorageManager.set(APP_CONFIG.STORAGE.KEYS.SUBSCRIPTIONS, this.subscriptions);
    }

    async _fetchFullAnimeData(detailLink) {
        try {
            const detailData = await APIManager.get(`${APP_CONFIG.API.BASE_URL}?animePage=${encodeURIComponent(detailLink)}`);
            if (!detailData || !detailData.episodes) {
                console.error("API tidak mengembalikan data episode yang valid.");
                return null;
            }

            const episodesWithLinks = await Promise.all(
                detailData.episodes.map(async (ep) => {
                    try {
                        const episodeData = await APIManager.get(`${APP_CONFIG.API.BASE_URL}?url=${encodeURIComponent(ep.link)}`);
                        return {
                            ...ep,
                            videoFrames: episodeData.videoFrames || [],
                            lastFetched: new Date().toISOString()
                        };
                    } catch (e) {
                        console.error(`Gagal mengambil link video untuk episode ${ep.title}:`, e);
                        return { ...ep, videoFrames: [] };
                    }
                })
            );

            return {
                ...detailData,
                episodes: episodesWithLinks
            };
        } catch (e) {
            console.error("Gagal mengambil data detail anime:", e);
            return null;
        }
    }
}

// --- 4. MANAJEMEN API & CACHE ---
class APIManager {
    static async get(url, options = {}) {
        const cacheKey = url;
        const cached = StorageManager.get(APP_CONFIG.STORAGE.KEYS.CACHE) || {};
        const cachedResponse = cached[cacheKey];

        if (cachedResponse && (Date.now() - cachedResponse.timestamp) < APP_CONFIG.API.CACHE_TTL) {
            console.log(`Cache hit for: ${url}`);
            return cachedResponse.data;
        }

        console.log(`Fetching from API: ${url}`);

        let lastError;
        for (let attempt = 0; attempt <= APP_CONFIG.API.RETRY_ATTEMPTS; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.API.TIMEOUT);

                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                cached[cacheKey] = {
                    data: data,
                    timestamp: Date.now()
                };
                StorageManager.set(APP_CONFIG.STORAGE.KEYS.CACHE, cached);

                return data;
            } catch (e) {
                lastError = e;
                console.warn(`API request attempt ${attempt + 1} failed for ${url}:`, e.message);
                if (attempt < APP_CONFIG.API.RETRY_ATTEMPTS) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                }
            }
        }
        throw lastError;
    }
}

// --- 5. MANAJER UI & TEMPLATES ---
class UIManager {
    constructor(router) {
        this.router = router;
        this.currentAnimeData = StorageManager.get(APP_CONFIG.STORAGE.KEYS.CURRENT_ANIME_DATA) || null;
        this.currentEpisodeIndex = StorageManager.get(APP_CONFIG.STORAGE.KEYS.CURRENT_EPISODE_INDEX) || 0;
        this.slideIndex = 0;
        this.slideInterval = null;
        this.subscriptionManager = new SubscriptionManager();
    }

    // --- Templates ---
    loader() {
        return `<div class="loader"><div class="loader-spinner"></div><p>Loading...</p></div>`;
    }

    homePage(data) {
        return `
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
                           ${(data.results || []).slice(0, 3).map((anime, index) => this.slideCard(anime, index)).join('')}
                        </div>
                    </div>
                    <div class="slider-dots">
                       ${(data.results || []).slice(0, 3).map((_, index) => ` <div class="slider-dot ${index === 0 ? 'active' : ''}" data-slide="${index}"></div>`).join('')}
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
                <div class="anime-grid">${(data.results || []).map(anime => this.animeCard(anime)).join('')}</div>
            </div>`;
    }

    searchPage(query, results) {
        return `
            <div class="search-page">
                <div class="page-title">Hasil Pencarian: "${query}"</div>
                <div class="search-results-grid">
                   ${results.map(anime => this.searchResultCard(anime)).join('')}
                </div>
            </div>`;
    }

    slideCard(anime, index) {
        return `
            <div class="slide-card ${index === 0 ? 'active' : ''}" data-link="${anime.link}" data-title="${anime.seriesTitle || anime.title}" data-thumbnail="${anime.thumbnail}">
                <div class="slide-image">
                    <img src="${anime.thumbnail}" alt="${anime.seriesTitle || anime.title}">
                   ${anime.episode ? ` <div class="slide-episode-badge">${anime.episode}</div>` : ''}
                </div>
                <div class="slide-content">
                    <h3 class="slide-title">${anime.seriesTitle || anime.title}</h3>
                </div>
            </div>`;
    }

    subscribePage() {
        const subs = this.subscriptionManager.getAll();
        return `
            <div class="page-title">Anime Berlangganan</div>
            <div class="subscription-grid">
               ${subs.length > 0 ? 
                    subs.map(sub => `
                        <div class="subscription-card" data-url="${sub.url}">
                            <img src="${sub.thumbnail}" alt="${sub.title}">
                            <div class="subscription-info">
                                <h3>${sub.title}</h3>
                            </div>
                        </div>
                   `).join('') : 
                   ' <div class="empty-state"><p>Belum ada anime yang disubscribe</p></div>'
               }
            </div>`;
    }

    accountPage(user) {
        return `
            <div class="page-title">Akun</div>
            <div class="account-section">
               ${user ? `
                    <div class="user-profile">
                        <div class="profile-picture">
                            <img src="${user.photoURL}" alt="Profile">
                        </div>
                        <div class="user-info">
                            <h3>${user.displayName}</h3>
                            <p>${user.email}</p>
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
            </div>`;
    }

    animeCard(anime) {
        return `
            <a href="#" class="anime-card" data-link="${anime.link}" data-title="${anime.seriesTitle || anime.title}" data-thumbnail="${anime.thumbnail}">
               ${anime.episode ? ` <div class="episode-badge">${anime.episode}</div>` : ''}
                <img src="${anime.thumbnail}" alt="${anime.seriesTitle || anime.title}">
                <div class="title">${anime.seriesTitle || anime.title}</div>
            </a>`;
    }

    searchResultCard(anime) {
        return `
            <a href="#" class="search-result-card" data-link="${anime.link}" data-title="${anime.title}" data-thumbnail="${anime.thumbnail}">
                <img src="${anime.thumbnail || 'https://via.placeholder.com/200x300'}" alt="${anime.title}">
                <div class="search-result-info">
                    <h3>${anime.title}</h3>
                </div>
            </a>`;
    }

    detailPage(data, title, thumbnail) {
        const isSubscribed = this.subscriptionManager.isSubscribed(title);
        const animeSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const episodes = this.currentAnimeData?.episodes || data.episodes || [];

        return `
            <div class="detail-header">
                <img src="${thumbnail}" alt="${title}">
                <div class="detail-info">
                    <h2>${title}</h2>
                    <p>Total Episode: ${episodes.length}</p>
                    <button id="subscribe-btn" class="subscribe-btn ${isSubscribed ? 'subscribed' : ''}" 
                            data-title="${title}" data-thumbnail="${thumbnail}" data-url="/${animeSlug}-pilih-episode" data-detail-link="${data.link}">
                        <span class="btn-text">${isSubscribed ? 'Tersubscribe' : 'Subscribe'}</span>
                        <span class="btn-icon">${isSubscribed ? '✓' : '+'}</span>
                    </button>
                </div>
            </div>
            <div class="episode-list">
               ${(episodes || []).map((ep, index) => `
                    <a href="#" class="episode-card" data-link="${ep.link}" data-episode-index="${index}">
                        <h3>${ep.title}</h3>
                    </a>
               `).join('')}
            </div>`;
    }

    watchPage(data, episodeIndex = 0) {
        const episodes = this.currentAnimeData?.episodes || [];
        const currentEp = episodes[episodeIndex];
        const hasPrev = episodeIndex > 0;
        const hasNext = episodeIndex < episodes.length - 1;

        return `
            <div class="watch-header">
                <button id="back-to-detail" class="back-btn">
                    <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                   Kembali
                </button>
                <h2 class="episode-title">${data.title}</h2>
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
            </div>`;
    }

    bottomNav(activePage) {
        return `
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
            </button>`;
    }

    // --- Render ---
    async render(page, params = {}) {
        const app = document.getElementById('app-content');
        const bottomNav = document.querySelector('.bottom-nav');

        app.innerHTML = this.loader();
        bottomNav.innerHTML = this.bottomNav(page);

        try {
            let content = '';
            if (page === 'home') {
                this.router.updateURL('/index');
                const data = await APIManager.get(APP_CONFIG.API.BASE_URL);
                if (!data.results || data.results.length === 0) throw new Error("API tidak mengembalikan hasil.");
                content = this.homePage(data);
                setTimeout(() => this.initSlider(), 100);
            } else if (page === 'search') {
                const query = params.query || this.router.getURLParams().s;
                this.router.updateURL('/', { s: query });
                const data = await APIManager.get(`${APP_CONFIG.API.BASE_URL}?search=${encodeURIComponent(query)}`);
                content = this.searchPage(query, data.results || []);
            } else if (page === 'subscribe') {
                this.router.updateURL('/subscribe');
                content = this.subscribePage();
            } else if (page === 'account') {
                this.router.updateURL('/akun');
                content = this.accountPage(this.router.currentUser);
            } else if (page === 'detail') {
                if (this.currentAnimeData) {
                    content = this.detailPage(this.currentAnimeData, this.currentAnimeData.title, this.currentAnimeData.thumbnail);
                } else {
                    content = `<p class="error-message">Data anime tidak ditemukan.</p>`;
                }
            } else if (page === 'watch') {
                if (this.currentAnimeData && this.currentAnimeData.episodes && this.currentAnimeData.episodes[this.currentEpisodeIndex]) {
                    content = this.watchPage(this.currentAnimeData.episodes[this.currentEpisodeIndex], this.currentEpisodeIndex);
                } else {
                    content = `<p class="error-message">Data episode tidak ditemukan.</p>`;
                }
            }
            app.innerHTML = content;
        } catch (e) {
            app.innerHTML = `<p class="error-message">Gagal memuat. (${e.message})</p>`;
        }
    }

    // --- Slider ---
    initSlider() {
        const track = document.getElementById('slider-track');
        const dots = document.querySelectorAll('.slider-dot');

        if (!track || !dots.length) return;

        const updateSlider = (index) => {
            this.slideIndex = index;
            track.style.transform = `translateX(-${index * 100}%)`;
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
        };

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => updateSlider(index));
        });

        this.slideInterval = setInterval(() => {
            this.slideIndex = (this.slideIndex + 1) % dots.length;
            updateSlider(this.slideIndex);
        }, APP_CONFIG.UI.SLIDER_AUTOPLAY_INTERVAL);
    }

    // --- Event Handlers ---
    async handleDetail(link, title, thumbnail, isFromHome = false) {
        const app = document.getElementById('app-content');
        app.innerHTML = this.loader();
        clearInterval(this.slideInterval);

        let detailLink = link;
        const animeSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        this.router.updateURL(`/${animeSlug}-pilih-episode`);

        if (isFromHome) {
            const searchData = await APIManager.get(`${APP_CONFIG.API.BASE_URL}?search=${encodeURIComponent(title)}`);
            if (searchData.results && searchData.results.length > 0) {
                detailLink = searchData.results[0].link;
            } else {
                app.innerHTML = `<p class="error-message">Gagal menemukan halaman detail untuk ${title}.</p>`;
                return;
            }
        }

        try {
            const fullData = await this.subscriptionManager._fetchFullAnimeData(detailLink);
            this.currentAnimeData = {
                ...fullData,
                title: title,
                thumbnail: thumbnail !== 'null' && thumbnail ? thumbnail : fullData.thumbnail
            };
            StorageManager.set(APP_CONFIG.STORAGE.KEYS.CURRENT_ANIME_DATA, this.currentAnimeData);
            const finalThumbnail = this.currentAnimeData.thumbnail;
            app.innerHTML = this.detailPage(this.currentAnimeData, title, finalThumbnail);
        } catch (e) {
            app.innerHTML = `<p class="error-message">Gagal memuat detail anime. (${e.message})</p>`;
        }
    }

    async handleWatch(link, episodeIndex = 0) {
        const app = document.getElementById('app-content');
        app.innerHTML = this.loader();
        this.currentEpisodeIndex = episodeIndex;
        StorageManager.set(APP_CONFIG.STORAGE.KEYS.CURRENT_EPISODE_INDEX, this.currentEpisodeIndex);

        if (!this.currentAnimeData || !this.currentAnimeData.episodes || !this.currentAnimeData.episodes[episodeIndex]) {
            app.innerHTML = `<p class="error-message">Data episode tidak valid.</p>`;
            return;
        }

        const animeTitle = this.currentAnimeData.title || 'anime';
        const animeSlug = animeTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
        this.router.updateURL(`/${animeSlug}-episode-${episodeIndex + 1}`);

        try {
            const data = await APIManager.get(`${APP_CONFIG.API.BASE_URL}?url=${encodeURIComponent(link)}`);
            app.innerHTML = this.watchPage(data, episodeIndex);
        } catch (e) {
            app.innerHTML = `<p class="error-message">Gagal memuat video. (${e.message})</p>`;
        }
    }

    async handleSubscribeClick(btn) {
        const title = btn.dataset.title;
        const thumbnail = btn.dataset.thumbnail;
        const url = btn.dataset.url;
        const detailLink = btn.dataset.detailLink;

        try {
            const isNowSubscribed = await this.subscriptionManager.subscribe(title, thumbnail, detailLink, url);
            btn.classList.add('animating');
            setTimeout(() => {
                btn.classList.toggle('subscribed', isNowSubscribed);
                btn.querySelector('.btn-text').textContent = isNowSubscribed ? 'Tersubscribe' : 'Subscribe';
                btn.querySelector('.btn-icon').textContent = isNowSubscribed ? '✓' : '+';
                btn.classList.remove('animating');
            }, 200);
        } catch (e) {
            alert(`Gagal menyubscribe: ${e.message}`);
        }
    }
}

// --- 6. ROUTER ---
class Router {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.currentPage = this.getCurrentPage();
        this.currentUser = null;

        if (window.firebaseAuth) {
            window.firebaseAuth.onAuthStateChanged(window.firebaseAuth.auth, (user) => {
                this.currentUser = user;
                if (this.currentPage === 'account') {
                    this.render('account');
                }
            });
        }
    }

    updateURL(path, params = {}) {
        const url = new URL(window.location);
        url.pathname = path;
        url.search = '';
        Object.keys(params).forEach(key => {
            if (params[key]) url.searchParams.set(key, params[key]);
        });
        window.history.pushState(null, '', url.toString());
    }

    getURLParams() {
        const params = new URLSearchParams(window.location.search);
        return Object.fromEntries(params.entries());
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path === '/' || path === '/index') return 'home';
        if (path === '/subscribe') return 'subscribe';
        if (path === '/akun') return 'account';
        if (path.includes('-episode-')) return 'watch';
        if (path.includes('-pilih-episode')) return 'detail';
        const params = this.getURLParams();
        if (params.s) return 'search';
        return 'home';
    }

    async render(page, params = {}) {
        this.currentPage = page;
        await this.uiManager.render(page, params);
    }
}

// --- 7. APLIKASI UTAMA ---
document.addEventListener('DOMContentLoaded', () => {
    const router = new Router(new UIManager());
    const uiManager = router.uiManager;

    // Event Listeners Global
    document.getElementById('app-content').addEventListener('submit', e => {
        if (e.target.id === 'main-search-form') {
            e.preventDefault();
            const query = e.target.querySelector('#main-search-input').value.trim();
            if (query) {
                clearInterval(uiManager.slideInterval);
                router.render('search', { query });
            }
        }
    });

    document.getElementById('app-content').addEventListener('click', e => {
        const card = e.target.closest('.anime-card, .search-result-card, .slide-card');
        if (card) {
            e.preventDefault();
            clearInterval(uiManager.slideInterval);
            const isFromHome = card.classList.contains('anime-card') || card.classList.contains('slide-card');
            uiManager.handleDetail(card.dataset.link, card.dataset.title, card.dataset.thumbnail, isFromHome);
            return;
        }

        const subCard = e.target.closest('.subscription-card');
        if (subCard) {
            e.preventDefault();
            window.location.href = subCard.dataset.url;
            return;
        }

        const epCard = e.target.closest('.episode-card');
        if (epCard) {
            e.preventDefault();
            const episodeIndex = parseInt(epCard.dataset.episodeIndex) || 0;
            uiManager.handleWatch(epCard.dataset.link, episodeIndex);
            return;
        }

        if (e.target.closest('#subscribe-btn')) {
            e.preventDefault();
            const btn = e.target.closest('#subscribe-btn');
            uiManager.handleSubscribeClick(btn);
        }

        if (e.target.closest('#google-login-btn')) {
            e.preventDefault();
            if (window.firebaseAuth) {
                window.firebaseAuth.signInWithPopup(window.firebaseAuth.auth, window.firebaseAuth.provider)
                    .catch(error => console.error('Login error:', error));
            }
        }

        if (e.target.closest('#logout-btn')) {
            e.preventDefault();
            if (window.firebaseAuth) {
                window.firebaseAuth.signOut(window.firebaseAuth.auth);
            }
        }

        if (e.target.closest('#back-to-detail')) {
            e.preventDefault();
            if (uiManager.currentAnimeData) {
                const animeSlug = uiManager.currentAnimeData.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
                router.updateURL(`/${animeSlug}-pilih-episode`);
                uiManager.render('detail');
            }
        }

        if (e.target.closest('#prev-episode') && !e.target.closest('#prev-episode').disabled) {
            e.preventDefault();
            if (uiManager.currentEpisodeIndex > 0 && uiManager.currentAnimeData?.episodes) {
                uiManager.handleWatch(uiManager.currentAnimeData.episodes[uiManager.currentEpisodeIndex - 1].link, uiManager.currentEpisodeIndex - 1);
            }
        }

        if (e.target.closest('#next-episode') && !e.target.closest('#next-episode').disabled) {
            e.preventDefault();
            if (uiManager.currentEpisodeIndex < (uiManager.currentAnimeData?.episodes?.length || 0) - 1 && uiManager.currentAnimeData?.episodes) {
                uiManager.handleWatch(uiManager.currentAnimeData.episodes[uiManager.currentEpisodeIndex + 1].link, uiManager.currentEpisodeIndex + 1);
            }
        }

        const gridItem = e.target.closest('.episode-grid-item');
        if (gridItem) {
            e.preventDefault();
            const episodeIndex = parseInt(gridItem.dataset.episodeIndex);
            if (uiManager.currentAnimeData?.episodes?.[episodeIndex]) {
                uiManager.handleWatch(uiManager.currentAnimeData.episodes[episodeIndex].link, episodeIndex);
            }
        }
    });

    document.querySelector('.bottom-nav').addEventListener('click', e => {
        const navButton = e.target.closest('.nav-button');
        if (navButton) {
            clearInterval(uiManager.slideInterval);
            router.render(navButton.dataset.page);
        }
    });

    window.addEventListener('popstate', () => {
        const page = router.getCurrentPage();
        const params = router.getURLParams();
        if (page === 'search' && params.s) {
            router.render('search', { query: params.s });
        } else {
            router.render(page);
        }
    });

    const initialPage = router.getCurrentPage();
    const initialParams = router.getURLParams();
    if (initialPage === 'search' && initialParams.s) {
        router.render('search', { query: initialParams.s });
    } else {
        router.render(initialPage);
    }
});
