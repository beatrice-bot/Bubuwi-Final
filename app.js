document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app-content');
    
    // ⬇️⬇️⬇️ PENTING: GANTI DENGAN URL NETLIFY-MU SENDIRI ⬇️⬇️⬇️
    const API_URL = "https://bubuwi-pro.netlify.app/api/scrape";
    // ⬆️⬆️⬆️ PENTING: GANTI DENGAN URL NETLIFY-MU SENDIRI ⬆️⬆️⬆️

    // Efek Parallax
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        document.querySelector('.saturn').style.transform = `translateY(${scrollY * 0.3}px)`;
        document.querySelector('.earth').style.transform = `translateY(${scrollY * 0.1}px)`;
    });

    const templates = {
        loader: () => `<p class="loader">Memuat data dari galaksi Bimasakti...</p>`,
        homePage: () => `
            <form id="search-form">
                <input type="search" id="search-input" placeholder="Ketik judul anime di sini...">
            </form>
            <div id="anime-grid-container"></div>
        `,
        animeCard: (anime) => `
            <a href="#" class="anime-card" data-link="${anime.link}" data-title="${anime.seriesTitle || anime.title}" data-thumbnail="${anime.thumbnail}">
                <img src="${anime.thumbnail}" alt="${anime.seriesTitle || anime.title}">
                <div class="title">${anime.seriesTitle || anime.title}</div>
            </a>`,
        detailPage: (data, title, link, thumbnail) => `
            <button class="back-button">← Kembali ke Daftar</button>
            <div class="detail-header">
                <img src="${thumbnail}" alt="${title}">
                <div class="detail-info">
                    <h2>${title}</h2>
                    <p>Total Episode: ${data.episodeCount || '?'}</p>
                </div>
            </div>
            <div class="episode-list">
                ${(data.episodes || []).map(ep => `
                    <a href="#" class="episode-card" data-link="${ep.link}" data-title="${ep.title}" data-thumbnail="${thumbnail}">
                        <h3>${ep.title}</h3>
                    </a>
                `).join('')}
            </div>`,
        watchPage: (data, thumbnail) => `
             <button class="back-button">← Kembali ke Episode</button>
             <h2 class="watch-title">${data.title}</h2>
             <div id="video-placeholder" class="video-placeholder" 
                  data-video-src="${data.videoFrames ? data.videoFrames[0] : ''}" 
                  style="background-image: url('${thumbnail}')">
                 <div class="play-button"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg></div>
             </div>
             <div id="video-container"></div>`
    };

    const router = {
        history: [],
        render: async (page, params = null) => {
            app.innerHTML = templates.loader();
            let content = '';
            try {
                switch(page) {
                    case 'home':
                        app.innerHTML = templates.homePage();
                        const gridContainer = document.getElementById('anime-grid-container');
                        const homeData = await fetch(API_URL).then(res => res.json());
                        gridContainer.innerHTML = `<div class="anime-grid">${(homeData.results || []).map(templates.animeCard).join('')}</div>`;
                        break;
                    case 'search':
                        const searchData = await fetch(`${API_URL}?search=${encodeURIComponent(params)}`).then(res => res.json());
                        app.innerHTML = templates.homePage();
                        document.getElementById('search-input').value = params;
                        document.getElementById('anime-grid-container').innerHTML = `<div class="anime-grid">${(searchData.results || []).map(templates.animeCard).join('')}</div>`;
                        break;
                    case 'detail':
                        const detailData = await fetch(`${API_URL}?animePage=${encodeURIComponent(params.link)}`).then(res => res.json());
                        app.innerHTML = templates.detailPage(detailData, params.title, params.link, params.thumbnail);
                        break;
                    case 'watch':
                        const watchData = await fetch(`${API_URL}?url=${encodeURIComponent(params.link)}`).then(res => res.json());
                        app.innerHTML = templates.watchPage(watchData, params.thumbnail);
                        break;
                }
            } catch (error) {
                app.innerHTML = `<p>Gagal memuat. Coba lagi nanti.</p><button class="back-button">Kembali</button>`;
            }
        }
    };

    app.addEventListener('click', e => {
        const card = e.target.closest('.anime-card, .episode-card');
        if (card) {
            e.preventDefault();
            router.history.push(app.innerHTML);
            const link = card.dataset.link;
            const title = card.dataset.title;
            const thumbnail = card.dataset.thumbnail;
            
            if (card.classList.contains('episode-card')) {
                router.render('watch', { link, title, thumbnail });
            } else {
                router.render('detail', { link, title, thumbnail });
            }
        }

        const backButton = e.target.closest('.back-button');
        if (backButton) {
            e.preventDefault();
            const lastState = router.history.pop();
            if (lastState) app.innerHTML = lastState;
            else router.render('home');
        }

        const placeholder = e.target.closest('#video-placeholder');
        if (placeholder) {
            const videoSrc = placeholder.dataset.videoSrc;
            if (videoSrc) {
                const videoContainer = document.getElementById('video-container');
                videoContainer.innerHTML = `<div class="video-container"><iframe src="${videoSrc}" allowfullscreen sandbox="allow-scripts allow-same-origin allow-presentation"></iframe></div>`;
                placeholder.style.display = 'none';
            }
        }
    });

    app.addEventListener('submit', e => {
        if (e.target.id === 'search-form') {
            e.preventDefault();
            const query = e.target.querySelector('#search-input').value.trim();
            if (query) {
                router.history.push(app.innerHTML);
                router.render('search', query);
            }
        }
    });

    router.render('home');
});
