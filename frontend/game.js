const TG = window.Telegram?.WebApp;
let playerData = null;
let game = null;

const ARENA_WIDTH = 3000;
const ARENA_HEIGHT = 3000;

const PLAYER_RADIUS = 18;
const PLAYER_COLOR = 0x9b59b6;
const PLAYER_SPEED = 200;

const ATTACK_RANGE = 60;
const ATTACK_ANGLE = Math.PI * 2 / 3;

const JOYSTICK_BASE_RADIUS = 60;
const JOYSTICK_THUMB_RADIUS = 25;
const JOYSTICK_ALPHA = 0.3;

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
        input: { activePointers: 2 },
        scene: [GameScene],
    });
}

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.player = null;
        this.playerLabel = null;
        this.attackCone = null;
        this.joystick = null;
        this.joystickActive = false;
        this.joystickDir = { x: 0, y: 0 };
        this.facingAngle = 0;
    }

    create() {
        this.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
        this.cameras.main.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        this.createArena();
        this.createPlayer();
        this.createAttackCone();
        this.createJoystick();

        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);

        hideLoading();
    }

    createArena() {
        const g = this.add.graphics();

        g.fillStyle(0x0f0f23, 1);
        g.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        g.lineStyle(1, 0x2a2a5e, 0.4);
        for (let x = 0; x <= ARENA_WIDTH; x += 100) {
            g.moveTo(x, 0);
            g.lineTo(x, ARENA_HEIGHT);
        }
        for (let y = 0; y <= ARENA_HEIGHT; y += 100) {
            g.moveTo(0, y);
            g.lineTo(ARENA_WIDTH, y);
        }
        g.strokePath();

        g.lineStyle(2, 0x4a4a9e, 0.5);
        for (let x = 0; x <= ARENA_WIDTH; x += 500) {
            g.moveTo(x, 0);
            g.lineTo(x, ARENA_HEIGHT);
        }
        for (let y = 0; y <= ARENA_HEIGHT; y += 500) {
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
        gfx.fillStyle(0xffffff, 0.12);
        gfx.fillCircle(mid, mid, PLAYER_RADIUS + 5);
        gfx.fillStyle(PLAYER_COLOR, 1);
        gfx.fillCircle(mid, mid, PLAYER_RADIUS);
        gfx.fillStyle(0x7c3aed, 1);
        gfx.fillCircle(mid, mid, PLAYER_RADIUS - 6);
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

    createAttackCone() {
        this.attackCone = this.add.graphics();
        this.attackCone.setDepth(9);
    }

    drawAttackCone() {
        this.attackCone.clear();

        const px = this.player.x;
        const py = this.player.y;
        const angle = this.facingAngle;
        const halfAngle = ATTACK_ANGLE / 2;

        this.attackCone.fillStyle(0x9b59b6, 0.12);
        this.attackCone.beginPath();
        this.attackCone.moveTo(px, py);
        this.attackCone.lineTo(
            px + Math.cos(angle - halfAngle) * ATTACK_RANGE,
            py + Math.sin(angle - halfAngle) * ATTACK_RANGE
        );
        this.attackCone.arc(px, py, ATTACK_RANGE, angle - halfAngle, angle + halfAngle, false);
        this.attackCone.closePath();
        this.attackCone.fillPath();

        this.attackCone.lineStyle(2, 0x9b59b6, 0.35);
        this.attackCone.beginPath();
        this.attackCone.arc(px, py, ATTACK_RANGE, angle - halfAngle, angle + halfAngle, false);
        this.attackCone.strokePath();

        this.attackCone.lineStyle(1, 0x9b59b6, 0.25);
        this.attackCone.beginPath();
        this.attackCone.moveTo(px, py);
        this.attackCone.lineTo(
            px + Math.cos(angle - halfAngle) * ATTACK_RANGE,
            py + Math.sin(angle - halfAngle) * ATTACK_RANGE
        );
        this.attackCone.moveTo(px, py);
        this.attackCone.lineTo(
            px + Math.cos(angle + halfAngle) * ATTACK_RANGE,
            py + Math.sin(angle + halfAngle) * ATTACK_RANGE
        );
        this.attackCone.strokePath();
    }

    createJoystick() {
        const x = 100;
        const y = this.scale.height - 100;

        this.joystickBase = this.add.graphics();
        this.joystickBase.setDepth(100);
        this.joystickBase.setScrollFactor(0);
        this.drawJoystickBase(x, y);

        this.joystickThumb = this.add.graphics();
        this.joystickThumb.setDepth(101);
        this.joystickThumb.setScrollFactor(0);
        this.drawJoystickThumb(x, y);

        this.joystick = { x, y };
    }

    drawJoystickBase(x, y) {
        this.joystickBase.clear();
        this.joystickBase.fillStyle(0xffffff, JOYSTICK_ALPHA);
        this.joystickBase.fillCircle(x, y, JOYSTICK_BASE_RADIUS);
        this.joystickBase.lineStyle(2, 0xffffff, 0.5);
        this.joystickBase.strokeCircle(x, y, JOYSTICK_BASE_RADIUS);
    }

    drawJoystickThumb(x, y) {
        this.joystickThumb.clear();
        this.joystickThumb.fillStyle(0xffffff, 0.6);
        this.joystickThumb.fillCircle(x, y, JOYSTICK_THUMB_RADIUS);
    }

    onPointerDown(pointer) {
        const dx = pointer.x - this.joystick.x;
        const dy = pointer.y - this.joystick.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < JOYSTICK_BASE_RADIUS + 40) {
            this.joystickActive = true;
            this.updateJoystick(pointer);
        }
    }

    onPointerMove(pointer) {
        if (this.joystickActive && pointer.isDown) {
            this.updateJoystick(pointer);
        }
    }

    onPointerUp() {
        this.joystickActive = false;
        this.joystickDir = { x: 0, y: 0 };
        this.drawJoystickThumb(this.joystick.x, this.joystick.y);
        this.player.setVelocity(0, 0);
    }

    updateJoystick(pointer) {
        let dx = pointer.x - this.joystick.x;
        let dy = pointer.y - this.joystick.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = JOYSTICK_BASE_RADIUS;

        let clampedDist = Math.min(dist, maxDist);
        let nx = dx / (dist || 1);
        let ny = dy / (dist || 1);

        if (dist > maxDist) {
            dx = nx * maxDist;
            dy = ny * maxDist;
        }

        this.drawJoystickThumb(this.joystick.x + dx, this.joystick.y + dy);

        const force = clampedDist / maxDist;
        this.joystickDir = { x: nx * force, y: ny * force };

        if (dist > 5) {
            this.facingAngle = Math.atan2(dy, dx);
        }
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

        const speed = this.player.getData('speed');
        this.player.setVelocity(
            this.joystickDir.x * speed,
            this.joystickDir.y * speed
        );

        if (this.joystickDir.x !== 0 || this.joystickDir.y !== 0) {
            this.player.setRotation(this.facingAngle + Math.PI / 2);
        }

        this.drawAttackCone();
    }

    resize() {
        const w = this.scale.width;
        const h = this.scale.height;
        this.cameras.main.setSize(w, h);

        if (this.joystick) {
            this.joystick.y = h - 100;
            this.drawJoystickBase(this.joystick.x, this.joystick.y);
            if (!this.joystickActive) {
                this.drawJoystickThumb(this.joystick.x, this.joystick.y);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', initTelegram);
