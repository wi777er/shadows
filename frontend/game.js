const TG = window.Telegram?.WebApp;
let playerData = null;

function initTelegram() {
    if (!TG) {
        console.warn('Not running in Telegram');
        playerData = {
            id: 'local_' + Date.now(),
            first_name: 'TestPlayer',
            username: 'test'
        };
        showPlayerInfo(playerData);
        hideLoading();
        return;
    }

    TG.ready();
    TG.expand();

    const user = TG.initDataUnsafe?.user;
    if (user) {
        playerData = {
            id: String(user.id),
            first_name: user.first_name || 'Unknown',
            username: user.username || ''
        };
        showPlayerInfo(playerData);
    }

    TG.MainButton?.hide();
    hideLoading();
}

function showPlayerInfo(data) {
    const nameEl = document.getElementById('player-name');
    const levelEl = document.getElementById('player-level');
    if (nameEl) nameEl.textContent = data.first_name;
    if (levelEl) levelEl.textContent = 'Lv. 1';
}

function hideLoading() {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 500);
    }
}

document.addEventListener('DOMContentLoaded', initTelegram);
