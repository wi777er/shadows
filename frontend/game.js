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
const ATTACK_COOLDOWN = 800;
const ATTACK_DAMAGE = 10;
const ATTACK_FLASH_DURATION = 150;

const ENERGY_FRAGMENTS_COUNT = 100;
const ENERGY_RADIUS = 6;
const ENERGY_PICKUP_RANGE = 35;
const ENERGY_GLOW_RADIUS = 14;

const XP_BASE = 100;
const XP_SCALE = 50;

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
        this.attackFlash = null;
        this.joystick = null;
        this.joystickActive = false;
        this.joystickDir = { x: 0, y: 0 };
        this.facingAngle = 0;
        this.attackTimer = 0;
        this.flashTimer = 0;
        this.enemyTargets = [];
        this.energyFragments = [];
        this.energyGraphics = null;
        this.collectFlashTimer = 0;
        this.levelUpTimer = 0;
    }

    create() {
        this.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
        this.cameras.main.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        this.createArena();
        this.createEnergyFragments();
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

    createEnergyFragments() {
        for (let i = 0; i < ENERGY_FRAGMENTS_COUNT; i++) {
            this.energyFragments.push({
                x: Phaser.Math.Between(100, ARENA_WIDTH - 100),
                y: Phaser.Math.Between(100, ARENA_HEIGHT - 100),
                value: Phaser.Math.Between(5, 20),
            });
        }
        this.energyGraphics = this.add.graphics();
        this.energyGraphics.setDepth(5);
    }

    drawEnergyFragments() {
        this.energyGraphics.clear();
        const t = this.time.now * 0.003;

        for (const frag of this.energyFragments) {
            const pulse = 1 + Math.sin(t + frag.x * 0.01 + frag.y * 0.01) * 0.15;

            this.energyGraphics.fillStyle(0x8b5cf6, 0.15 * pulse);
            this.energyGraphics.fillCircle(frag.x, frag.y, ENERGY_GLOW_RADIUS * pulse);

            this.energyGraphics.fillStyle(0xa78bfa, 0.4 * pulse);
            this.energyGraphics.fillCircle(frag.x, frag.y, ENERGY_RADIUS * pulse + 2);

            this.energyGraphics.fillStyle(0xffffff, 0.5 * pulse);
            this.energyGraphics.fillCircle(frag.x, frag.y, ENERGY_RADIUS * pulse);
        }
    }

    checkEnergyPickup() {
        const px = this.player.x;
        const py = this.player.y;

        for (let i = this.energyFragments.length - 1; i >= 0; i--) {
            const frag = this.energyFragments[i];
            const dx = px - frag.x;
            const dy = py - frag.y;
            if (Math.sqrt(dx * dx + dy * dy) < ENERGY_PICKUP_RANGE) {
                this.collectFragment(i);
            }
        }
    }

    collectFragment(index) {
        const frag = this.energyFragments[index];
        this.energyFragments.splice(index, 1);
        this.collectFlashTimer = 200;

        let exp = this.player.getData('exp') + frag.value;
        let level = this.player.getData('level');
        let expToNext = this.player.getData('expToNext');

        while (exp >= expToNext) {
            exp -= expToNext;
            level++;
            expToNext = XP_BASE + (level - 1) * XP_SCALE;

            const maxHp = this.player.getData('maxHp') + 10;
            this.player.setData('maxHp', maxHp);
            this.player.setData('hp', maxHp);
            this.player.setData('damage', this.player.getData('damage') + 2);
            this.player.setData('speed', Math.min(300, this.player.getData('speed') + 5));
            this.levelUpTimer = 500;
        }

        this.player.setData('exp', exp);
        this.player.setData('level', level);
        this.player.setData('expToNext', expToNext);
        this.updateUI();
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
        this.player.setData('damage', ATTACK_DAMAGE);
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

        this.attackFlash = this.add.graphics();
        this.attackFlash.setDepth(9);
    }

    drawCone(graphics, px, py, angle, alpha) {
        graphics.clear();
        const halfAngle = ATTACK_ANGLE / 2;

        graphics.fillStyle(0x9b59b6, alpha * 0.12);
        graphics.beginPath();
        graphics.moveTo(px, py);
        graphics.lineTo(
            px + Math.cos(angle - halfAngle) * ATTACK_RANGE,
            py + Math.sin(angle - halfAngle) * ATTACK_RANGE
        );
        graphics.arc(px, py, ATTACK_RANGE, angle - halfAngle, angle + halfAngle, false);
        graphics.closePath();
        graphics.fillPath();

        graphics.lineStyle(2, 0x9b59b6, alpha * 0.35);
        graphics.beginPath();
        graphics.arc(px, py, ATTACK_RANGE, angle - halfAngle, angle + halfAngle, false);
        graphics.strokePath();

        graphics.lineStyle(1, 0x9b59b6, alpha * 0.25);
        graphics.beginPath();
        graphics.moveTo(px, py);
        graphics.lineTo(px + Math.cos(angle - halfAngle) * ATTACK_RANGE, py + Math.sin(angle - halfAngle) * ATTACK_RANGE);
        graphics.moveTo(px, py);
        graphics.lineTo(px + Math.cos(angle + halfAngle) * ATTACK_RANGE, py + Math.sin(angle + halfAngle) * ATTACK_RANGE);
        graphics.strokePath();
    }

    drawFlash(graphics, px, py, angle, progress) {
        graphics.clear();
        const halfAngle = ATTACK_ANGLE / 2;
        const alpha = 1 - progress;
        const r = ATTACK_RANGE * (1 + progress * 0.3);

        graphics.fillStyle(0xffffff, alpha * 0.4);
        graphics.beginPath();
        graphics.moveTo(px, py);
        graphics.lineTo(
            px + Math.cos(angle - halfAngle) * r,
            py + Math.sin(angle - halfAngle) * r
        );
        graphics.arc(px, py, r, angle - halfAngle, angle + halfAngle, false);
        graphics.closePath();
        graphics.fillPath();

        graphics.lineStyle(3, 0xffffff, alpha * 0.6);
        graphics.beginPath();
        graphics.arc(px, py, r, angle - halfAngle, angle + halfAngle, false);
        graphics.strokePath();
    }

    performAttack() {
        const px = this.player.x;
        const py = this.player.y;
        const dmg = this.player.getData('damage');

        this.flashTimer = ATTACK_FLASH_DURATION;

        for (let i = this.enemyTargets.length - 1; i >= 0; i--) {
            const target = this.enemyTargets[i];
            if (!target.active || !target.getData('alive')) continue;

            const dx = target.x - px;
            const dy = target.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > ATTACK_RANGE) continue;

            let angleToTarget = Math.atan2(dy, dx);
            let diff = angleToTarget - this.facingAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            if (Math.abs(diff) <= ATTACK_ANGLE / 2) {
                const newHp = target.getData('hp') - dmg;
                target.setData('hp', newHp);
                if (newHp <= 0) {
                    target.setData('alive', false);
                }
            }
        }
    }

    isInAttackCone(x, y) {
        const dx = x - this.player.x;
        const dy = y - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > ATTACK_RANGE) return false;

        let angleToTarget = Math.atan2(dy, dx);
        let diff = angleToTarget - this.facingAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        return Math.abs(diff) <= ATTACK_ANGLE / 2;
    }

    addTarget(sprite) {
        if (!sprite.getData('hp')) sprite.setData('hp', 50);
        if (!sprite.getData('alive')) sprite.setData('alive', true);
        this.enemyTargets.push(sprite);
    }

    removeTarget(sprite) {
        const idx = this.enemyTargets.indexOf(sprite);
        if (idx !== -1) this.enemyTargets.splice(idx, 1);
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

    update(time, delta) {
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

        const px = this.player.x;
        const py = this.player.y;
        const angle = this.facingAngle;

        this.drawCone(this.attackCone, px, py, angle, 1);

        if (this.flashTimer > 0) {
            this.flashTimer -= delta;
            const progress = 1 - this.flashTimer / ATTACK_FLASH_DURATION;
            this.drawFlash(this.attackFlash, px, py, angle, Math.min(1, Math.max(0, progress)));
        } else {
            this.attackFlash.clear();
        }

        this.attackTimer -= delta;
        if (this.attackTimer <= 0) {
            this.attackTimer = ATTACK_COOLDOWN;
            this.performAttack();
        }

        this.drawEnergyFragments();
        this.checkEnergyPickup();

        this.collectFlashTimer -= delta;
        if (this.collectFlashTimer > 0) {
            const p = this.collectFlashTimer / 200;
            this.energyGraphics.fillStyle(0xa78bfa, p * 0.5);
            this.energyGraphics.fillCircle(px, py, 20 + (1 - p) * 15);
        }

        if (this.levelUpTimer > 0) {
            this.levelUpTimer -= delta;
            const p = this.levelUpTimer / 500;
            const r = PLAYER_RADIUS + (1 - p) * 20;
            this.energyGraphics.fillStyle(0x9b59b6, p * 0.3);
            this.energyGraphics.fillCircle(px, py, r);
        }
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
