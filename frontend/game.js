const TG = window.Telegram?.WebApp;
let playerData = null;
let game = null;

function initTelegram() {
    if (!TG) {
        console.warn('Not running in Telegram');
        playerData = { id: 'local_' + Date.now(), first_name: 'TestPlayer', username: 'test' };
        showPlayerInfo(playerData);
        startPhaser();
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
    startPhaser();
}

function showPlayerInfo(data) {
    const nameEl = document.getElementById('player-name');
    if (nameEl) nameEl.textContent = data.first_name;
}

function hideLoading() {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 500);
    }
}

function startPhaser() {
    const container = document.getElementById('game-container');
    if (!container) return;

    game = new Phaser.Game({
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'game-container',
        backgroundColor: '#1a1a2e',
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: [GameScene],
    });
}

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;

        this.add.text(w / 2, h / 2 - 20, 'Shadow Survivor', {
            fontSize: '32px', color: '#9b59b6', fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.add.text(w / 2, h / 2 + 30, 'Phaser 3 loaded', {
            fontSize: '18px', color: '#666', fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.add.text(w / 2, h / 2 + 70, `Player: ${playerData?.first_name || '???'}`, {
            fontSize: '16px', color: '#888', fontFamily: 'Arial'
        }).setOrigin(0.5);

        hideLoading();
    }

    resize() {
        const w = this.scale.width;
        const h = this.scale.height;
        this.cameras.main.setSize(w, h);
    }
}

document.addEventListener('DOMContentLoaded', initTelegram);
