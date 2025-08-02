document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app-content');
    const bottomNav = document.querySelector('.bottom-nav');

    // GANTI DENGAN URL NETLIFY-MU
    const API_URL = "https://bubuwi.netlify.app/api/scrape";

    const templates = {
        loader: () => `<p class="loader">Loading...</p>`,
        homePage: (data) => `
            <div class="page-title">Cari Anime</div>
            <form id="search-form"><input type="search" id="search-input" placeholder="Ketik di sini..."></form>
            <div class="page-title">Anime Baru Rilis</div>
            <div class="anime-grid">
                ${(data.results || []).map(templates.animeCard).join('')}
            </div>
        `,
        animeCard: (anime) => `
            <a href="#" class="anime-card" data-link="${anime.link}" data-title="${anime.seriesTitle || anime.title}" data-thumbnail="${anime.thumbnail}">
                <img src="${anime.thumbnail}" alt="">
                <div class="title">${anime.seriesTitle || anime.title}</div>
            </a>`,
        detailPage: (data, title, thumbnail) => `
            <div class="detail-header">
                <img src="${thumbnail}" alt="${title}">
                <div class="detail-info">
                    <h2>${title}</h2>
                    <p>Total Episode: ${data.episodeCount || '?'}</p>
                </div>
            </div>
            <div class="episode-list">
                ${(data.episodes || []).map(ep => `
                    <a href="#" class="episode-card" data-link="${ep.link}" data-title="${ep.title}">
                        <h3>${ep.title}</h3>
                    </a>
                `).join('')}
            </div>`,
        watchPage: (data) => `
             <h2 class="watch-title">${data.title}</h2>
             <div class="video-container">
                <iframe src="${data.videoFrames ? data.videoFrames[0] : ''}" allowfullscreen></iframe>
             </div>`,
        contactPage: () => `
            <div class="page-title">Kontak Developer</div>
            <p>Dibuat dengan ❤️ untuk tujuan belajar.</p>
            <p>Instagram: @adnanmwa</p>
            <p>TikTok: @adnansagiri</p>`
    };

    const router = {
        render: async (page) => {
            app.innerHTML = templates.loader();
            try {
                switch(page) {
                    case 'home':
                        const homeData = await fetch(API_URL).then(res => res.json());
                        app.innerHTML = templates.homePage(homeData);
                        break;
                    case 'contact':
                        app.innerHTML = templates.contactPage();
                        break;
                }
            } catch (e) {
                app.innerHTML = `<p>Gagal memuat. Coba lagi.</p>`;
            }
        }
    };

    const handleSearch = async (query) => {
        app.innerHTML = templates.loader();
        const searchData = await fetch(`${API_URL}?search=${encodeURIComponent(query)}`).then(res => res.json());
        app.innerHTML = `<div class="anime-grid">${(searchData.results || []).map(templates.animeCard).join('')}</div>`;
    };

    const handleDetail = async (link, title, thumbnail) => {
        app.innerHTML = templates.loader();
        const detailData = await fetch(`${API_URL}?animePage=${encodeURIComponent(link)}`).then(res => res.json());
        app.innerHTML = templates.detailPage(detailData, title, thumbnail);
    };

    const handleWatch = async (link) => {
        app.innerHTML = templates.loader();
        const watchData = await fetch(`${API_URL}?url=${encodeURIComponent(link)}`).then(res => res.json());
        // ===== PERUBAHAN UTAMA: TIDAK ADA SANDBOX LAGI =====
        app.innerHTML = templates.watchPage(watchData);
    };

    app.addEventListener('submit', e => {
        if (e.target.id === 'search-form') {
            e.preventDefault();
            handleSearch(e.target.querySelector('#search-input').value.trim());
        }
    });

    app.addEventListener('click', e => {
        const card = e.target.closest('.anime-card');
        if (card) {
            e.preventDefault();
            handleDetail(card.dataset.link, card.dataset.title, card.dataset.thumbnail);
        }
        const epCard = e.target.closest('.episode-card');
        if (epCard) {
            e.preventDefault();
            handleWatch(epCard.dataset.link);
        }
    });

    bottomNav.addEventListener('click', e => {
        const navButton = e.target.closest('.nav-button');
        if (navButton) {
            document.querySelector('.nav-button.active').classList.remove('active');
            navButton.classList.add('active');
            router.render(navButton.dataset.page);
        }
    });

    router.render('home');
});
