const TG = window.Telegram?.WebApp;
let playerData = null;
let game = null;

const ARENA_WIDTH = 3000;
const ARENA_HEIGHT = 3000;

const PLAYER_RADIUS = 18;
const PLAYER_COLOR = 0x9b59b6;
const PLAYER_SPEED = 200;

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
        this.player = null;
        this.playerLabel = null;
    }

    create() {
        this.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
        this.cameras.main.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        this.createArena();
        this.createPlayer();

        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

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

    createPlayer() {
        const cx = ARENA_WIDTH / 2;
        const cy = ARENA_HEIGHT / 2;
        const s = (PLAYER_RADIUS + 8) * 2;

        const gfx = this.make.graphics({ add: false });
        const mid = s / 2;
        gfx.fillStyle(0xffffff, 0.15);
        gfx.fillCircle(mid, mid, PLAYER_RADIUS + 6);
        gfx.fillStyle(PLAYER_COLOR, 1);
        gfx.fillCircle(mid, mid, PLAYER_RADIUS);
        gfx.fillStyle(0x8e44ad, 1);
        gfx.fillTriangle(mid, mid - PLAYER_RADIUS - 4, mid - 8, mid - 2, mid + 8, mid - 2);
        gfx.generateTexture('player_tex', s, s);
        gfx.destroy();

        this.player = this.physics.add.sprite(cx, cy, 'player_tex');
        this.player.body.setCircle(PLAYER_RADIUS, (s / 2) - PLAYER_RADIUS, (s / 2) - PLAYER_RADIUS);
        this.player.body.setCollideWorldBounds(true);
        this.player.setDepth(10);
        this.player.setData('hp', 100);
        this.player.setData('maxHp', 100);
        this.player.setData('level', 1);
        this.player.setData('exp', 0);
        this.player.setData('expToNext', 100);
        this.player.setData('damage', 10);
        this.player.setData('speed', PLAYER_SPEED);
        this.player.setData('kills', 0);

        this.playerLabel = this.add.text(cx, cy - PLAYER_RADIUS - 14, playerData?.first_name || 'Player', {
            fontSize: '13px', color: '#ffffff', fontFamily: 'Arial',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(11);

        this.updateUI();
    }

    updateUI() {
        const hp = this.player.getData('hp');
        const maxHp = this.player.getData('maxHp');
        const level = this.player.getData('level');
        const exp = this.player.getData('exp');
        const expToNext = this.player.getData('expToNext');
        const kills = this.player.getData('kills');

        document.getElementById('player-level').textContent = `Lv. ${level}`;

        const hpPct = Math.max(0, hp / maxHp * 100);
        document.getElementById('hp-fill').style.width = `${hpPct}%`;
        document.getElementById('hp-text').textContent = `${Math.max(0, hp)}/${maxHp}`;

        const expPct = Math.min(100, exp / expToNext * 100);
        document.getElementById('exp-fill').style.width = `${expPct}%`;
        document.getElementById('exp-text').textContent = `${exp}/${expToNext}`;

        document.getElementById('kill-counter').textContent = `Kills: ${kills}`;
    }

    update() {
        if (!this.player) return;

        this.playerLabel.setPosition(this.player.x, this.player.y - PLAYER_RADIUS - 14);
    }

    resize() {
        const w = this.scale.width;
        const h = this.scale.height;
        this.cameras.main.setSize(w, h);
    }
}

document.addEventListener('DOMContentLoaded', initTelegram);
