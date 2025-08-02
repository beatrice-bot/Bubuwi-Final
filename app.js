document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app-content');
    const bottomNav = document.querySelector('.bottom-nav');

    // GANTI DENGAN URL NETLIFY-MU
    const API_URL = "https://bubuwi-pro.netlify.app/api/scrape";

    const templates = {
        loader: () => `<p class="loader">Loading...</p>`,
        homePage: (data) => `
            <div class="page-title">Anime Baru Rilis</div>
            <div class="anime-grid">${(data.results || []).map(templates.animeCard).join('')}</div>`,
        searchPage: () => `
            <div class="page-title">Pencarian</div>
            <form id="search-form"><input type="search" id="search-input" placeholder="Ketik judul anime..."></form>
            <div id="search-results" class="anime-grid"></div>`,
        contactPage: () => `
    <div class="contact-container">
        <div class="page-title">Kontak Developer</div>
        <img src="icons/icon-192x192.png" alt="Logo Bubuwi" class="contact-page-logo">
        <a href="https://www.instagram.com/adnanmwa" target="_blank" class="contact-link">
            <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" alt="Instagram">
            <span>@adnanmwa</span>
        </a>
        <a href="https://www.tiktok.com/@adnansagiri" target="_blank" class="contact-link">
            <img src="https://sf-static.tiktokcdn.com/obj/tiktok-web/tiktok/web/node/_next/static/images/logo-dark-e95da587b6efa1520d8f332845c23067.svg" alt="TikTok">
            <span>@adnansagiri</span>
        </a>
    </div>`
        detailPage: (data, title, thumbnail) => `
            <div class="detail-header">
                <img src="${thumbnail}" alt="${title}">
                <div class="detail-info"><h2>${title}</h2><p>Total Episode: ${data.episodeCount || '?'}</p></div>
            </div>
            <div class="episode-list">${(data.episodes || []).map(ep => `<a href="#" class="episode-card" data-link="${ep.link}"><h3>${ep.title}</h3></a>`).join('')}</div>`,
        watchPage: (data) => `<h2 class="watch-title">${data.title}</h2><div class="video-container"><iframe src="${data.videoFrames ? data.videoFrames[0] : ''}" allowfullscreen></iframe></div>`,
        bottomNav: (activePage) => `
            <button class="nav-button ${activePage === 'home' ? 'active' : ''}" data-page="home">
                <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg><span>Home</span>
            </button>
            <button class="nav-button ${activePage === 'search' ? 'active' : ''}" data-page="search">
                <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14z"/></svg><span>Cari</span>
            </button>
            <button class="nav-button ${activePage === 'contact' ? 'active' : ''}" data-page="contact">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6m0 13c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5Z"/></svg><span>Kontak</span>
            </button>`
    };

    const router = {
        render: async (page) => {
            app.innerHTML = templates.loader();
            bottomNav.innerHTML = templates.bottomNav(page);
            try {
                let content = '';
                if (page === 'home') {
                    const data = await fetch(API_URL).then(res => res.json());
                    content = templates.homePage(data);
                } else if (page === 'search') {
                    content = templates.searchPage();
                } else if (page === 'contact') {
                    content = templates.contactPage();
                }
                app.innerHTML = content;
            } catch (e) { app.innerHTML = `<p>Gagal memuat. Coba lagi.</p>`; }
        }
    };

    const handleSearch = async (query) => {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;
        resultsContainer.innerHTML = templates.loader();
        const data = await fetch(`${API_URL}?search=${encodeURIComponent(query)}`).then(res => res.json());
        resultsContainer.innerHTML = (data.results || []).map(templates.animeCard).join('');
    };

    const handleDetail = async (link, title, thumbnail) => {
        app.innerHTML = templates.loader();
        const data = await fetch(`${API_URL}?animePage=${encodeURIComponent(link)}`).then(res => res.json());
        app.innerHTML = templates.detailPage(data, title, thumbnail);
    };

    const handleWatch = async (link) => {
        app.innerHTML = templates.loader();
        const data = await fetch(`${API_URL}?url=${encodeURIComponent(link)}`).then(res => res.json());
        app.innerHTML = templates.watchPage(data);
    };

    app.addEventListener('submit', e => {
        if (e.target.id === 'search-form') {
            e.preventDefault();
            handleSearch(e.target.querySelector('#search-input').value.trim());
        }
    });

    app.addEventListener('click', e => {
        const card = e.target.closest('.anime-card');
        if (card) { e.preventDefault(); handleDetail(card.dataset.link, card.dataset.title, card.dataset.thumbnail); }
        const epCard = e.target.closest('.episode-card');
        if (epCard) { e.preventDefault(); handleWatch(epCard.dataset.link); }
    });

    bottomNav.addEventListener('click', e => {
        const navButton = e.target.closest('.nav-button');
        if (navButton) router.render(navButton.dataset.page);
    });

    router.render('home');
});
