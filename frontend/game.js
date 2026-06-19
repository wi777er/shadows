const TG = window.Telegram?.WebApp;
let playerData = null;
let game = null;

const ARENA_WIDTH = 3000;
const ARENA_HEIGHT = 3000;

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
        backgroundColor: '#0a0a0a',
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false },
        },
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
        this.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
        this.cameras.main.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        this.createArena();
        this.cameras.main.setScroll(ARENA_WIDTH / 2 - this.scale.width / 2, ARENA_HEIGHT / 2 - this.scale.height / 2);

        hideLoading();
    }

    createArena() {
        const g = this.add.graphics();

        g.fillStyle(0x16213e, 1);
        g.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        g.lineStyle(1, 0x1a1a3e, 0.3);
        for (let x = 0; x <= ARENA_WIDTH; x += 100) {
            g.moveTo(x, 0);
            g.lineTo(x, ARENA_HEIGHT);
        }
        for (let y = 0; y <= ARENA_HEIGHT; y += 100) {
            g.moveTo(0, y);
            g.lineTo(ARENA_WIDTH, y);
        }
        g.strokePath();

        g.lineStyle(4, 0x9b59b6, 0.8);
        g.strokeRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        g.lineStyle(2, 0x9b59b6, 0.3);
        g.strokeRect(50, 50, ARENA_WIDTH - 100, ARENA_HEIGHT - 100);
    }

    resize() {
        const w = this.scale.width;
        const h = this.scale.height;
        this.cameras.main.setSize(w, h);
    }
}

document.addEventListener('DOMContentLoaded', initTelegram);
