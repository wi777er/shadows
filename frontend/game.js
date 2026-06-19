const TG = window.Telegram?.WebApp;
let playerData = null;
let game = null;

window.onerror = function (msg, url, line) {
    const el = document.getElementById('loading-screen');
    if (el) el.innerHTML = '<h1 style="color:#e74c3c">JS Error</h1><pre style="color:#fff;padding:20px;text-align:left;white-space:pre-wrap">' + msg + ' (line ' + line + ')</pre>';
    return true;
};

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
const ENERGY_GLOW_RADIUS = 20;
const ENERGY_PICKUP_RANGE = 35;
const ENERGY_RESPAWN_DELAY = { min: 5000, max: 10000 };

const BOT_COUNT = 30;
const BOT_RADIUS = 16;
const BOT_COLOR = 0xdc2626;
const BOT_RESPAWN_DELAY = { min: 5000, max: 10000 };
const BOT_AI_INTERVAL = { min: 300, max: 800 };
const BOT_ATTACK_COOLDOWN = 800;
const BOT_FLEE_HP_RATIO = 0.3;
const BOT_SEEK_RANGE = 300;
const BOT_ATTACK_RANGE = 55;
const BOT_CHASE_RANGE = 300;
const KNOCKBACK_FORCE = 250;

const XP_BASE = 100;
const XP_SCALE = 50;
const XP_PER_KILL = 25;

const JOYSTICK_BASE_RADIUS = 60;
const JOYSTICK_THUMB_RADIUS = 25;
const JOYSTICK_ALPHA = 0.3;

const BOT_PREFIXES = [
    'Shadow', 'Night', 'Void', 'Dusk', 'Dark', 'Frost', 'Blood', 'Storm', 'Grim', 'Ash',
    'Flame', 'Iron', 'Crystal', 'Nether', 'Grave', 'Mist', 'Rust', 'Bone', 'Ember', 'Frozen',
    'Wraith', 'Cinder', 'Blight', 'Dread', 'Sorrow', 'Obsidian', 'Twilight', 'Umbra', 'Nocturne',
    'Doom', 'Fallen', 'Silent', 'Black', 'Pale', 'Crimson', 'Venom', 'Thunder', 'Wild', 'Savage',
    'Ebon', 'Witch', 'Dark', 'Gloom', 'Ashen', 'Raven', 'Scarlet', 'Ghost', 'Vile', 'Mad',
];

const BOT_SUFFIXES = [
    'Wraith', 'Stalker', 'Walker', 'Hunter', 'Blade', 'Reaper', 'Fang', 'Knight', 'Shade', 'Lord',
    'Howler', 'Hound', 'Raven', 'Viper', 'Lynx', 'Bear', 'Rogue', 'Mage', 'Monk', 'Warden',
    'Seeker', 'Runner', 'Terror', 'Phoenix', 'Wolf', 'Vulture', 'Crawler', 'Guard', 'Watcher',
    'Wanderer', 'Revenant', 'Phantom', 'Drinker', 'Wight', 'Thorn', 'Husk', 'One', 'Sun', 'Warrior',
    'Slayer', 'Sentinel', 'Bane', 'Maw', 'Claw', 'Soul', 'Weaver', 'Caller', 'Spawn', 'Fiend',
];

function generateBotName() {
    const p = BOT_PREFIXES[Math.floor(Math.random() * BOT_PREFIXES.length)];
    const s = BOT_SUFFIXES[Math.floor(Math.random() * BOT_SUFFIXES.length)];
    return `${p} ${s}`;
}

function initTelegram() {
    if (!TG) {
        console.warn('Not running in Telegram');
        document.getElementById('nickname-overlay').classList.remove('hidden');
        document.getElementById('loading-screen').style.display = 'none';
        const input = document.getElementById('nickname-input');
        const btn = document.getElementById('nickname-btn');
        const start = () => {
            const name = input.value.trim() || 'Player';
            playerData = { id: 'local_' + Date.now(), first_name: name, username: '' };
            document.getElementById('nickname-overlay').classList.add('hidden');
            showPlayerInfo(playerData);
            startPhaser();
        };
        btn.onclick = start;
        input.onkeydown = (e) => { if (e.key === 'Enter') start(); };
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
    setTimeout(() => {
        const ls = document.getElementById('loading-screen');
        if (ls && ls.style.display !== 'none' && ls.style.opacity !== '0') {
            ls.innerHTML = '<h1>Shadow Survivor</h1><p style="color:#e67e22">Phaser не загрузился</p>';
        }
    }, 5000);
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

    try {
        game = new Phaser.Game({
            type: Phaser.CANVAS,
            width: window.innerWidth,
            height: window.innerHeight,
            parent: 'game-container',
            backgroundColor: '#0a0a0a',
            physics: {
                default: 'arcade',
                arcade: { gravity: { y: 0 }, debug: false },
            },
            scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
            input: { activePointers: 2 },
            scene: [GameScene],
        });
    } catch (e) {
        console.error('Phaser init error:', e);
        document.getElementById('loading-screen').innerHTML =
            '<h1 style="color:#e74c3c">Error</h1><p style="color:#fff;font-size:14px;padding:20px">' +
            e.message + '</p>';
    }
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
        this.bots = [];
        this.botGraphics = null;
        this.energyRespawnQueue = [];
        this.botGroup = null;
        this.playerRespawnTimer = 0;
        this.stunTimer = 0;
        this.ws = null;
        this.remotePlayers = {};
        this.playerId = null;
        this.lastSentPos = { x: 0, y: 0 };
        this.wsReconnectTimer = 0;
        this.sendMoveTimer = 0;
        this.upgradeTimer = null;
        this.joystickPointerId = null;
        this.lastSentAngle = 0;
    }

    create() {
        this.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
        this.cameras.main.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        this.createArena();
        this.createEnergyFragments();

        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);

        document.getElementById('return-btn').onclick = () => this.returnToBattle();
        document.getElementById('change-map-btn').onclick = () => this.changeMap();
        document.querySelectorAll('.upgrade-btn').forEach(btn => {
            btn.onclick = () => this.applyUpgrade(btn.dataset.stat);
        });

        this.cursors = null;
        this.wasd = null;
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = this.input.keyboard.addKeys('W,A,S,D');
        }
        if (this.scale) this.scale.on('resize', this.resize, this);

        hideLoading();
        this.showJoinBattle();
    }

    createArena() {
        const g = this.add.graphics();
        g.fillStyle(0x0f0f23, 1);
        g.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        g.lineStyle(1, 0x2a2a5e, 0.4);
        for (let x = 0; x <= ARENA_WIDTH; x += 100) { g.moveTo(x, 0); g.lineTo(x, ARENA_HEIGHT); }
        for (let y = 0; y <= ARENA_HEIGHT; y += 100) { g.moveTo(0, y); g.lineTo(ARENA_WIDTH, y); }
        g.strokePath();

        g.lineStyle(2, 0x4a4a9e, 0.5);
        for (let x = 0; x <= ARENA_WIDTH; x += 500) { g.moveTo(x, 0); g.lineTo(x, ARENA_HEIGHT); }
        for (let y = 0; y <= ARENA_HEIGHT; y += 500) { g.moveTo(0, y); g.lineTo(ARENA_WIDTH, y); }
        g.strokePath();

        g.lineStyle(4, 0x9b59b6, 0.8);
        g.strokeRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
        g.lineStyle(2, 0x9b59b6, 0.3);
        g.strokeRect(50, 50, ARENA_WIDTH - 100, ARENA_HEIGHT - 100);
    }

    showJoinBattle() {
        const overlay = document.getElementById('battle-overlay');
        overlay.classList.remove('hidden');
        document.getElementById('battle-status').textContent = 'Join the arena';
        document.getElementById('join-battle-btn').className = '';
        document.getElementById('join-battle-btn').onclick = () => this.enterBattle();
    }

    enterBattle() {
        document.getElementById('battle-overlay').classList.add('hidden');
        this.playerId = playerData?.id || 'local_' + Date.now();
        this.connectWs();
        this.botGroup = this.physics.add.group();
        this.createPlayer();
        this.createAttackCone();
        this.createBots();
        this.createJoystick();
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.physics.add.collider(this.player, this.botGroup);
        this.physics.add.collider(this.botGroup, this.botGroup);
    }

    connectWs() {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const name = encodeURIComponent(playerData?.first_name || 'Player');
        this.ws = new WebSocket(`${proto}//${host}/ws/${this.playerId}?name=${name}`);
        this.ws.onopen = () => {};
        this.ws.onmessage = (event) => {
            try { this.handleWsMessage(JSON.parse(event.data)); }
            catch (e) { console.warn('WS parse error', e); }
        };
        this.ws.onclose = () => {
            setTimeout(() => { if (this.player) this.connectWs(); }, 3000);
        };
    }

    handleWsMessage(msg) {
        if (msg.type === 'state') {
            this.updateRemotePlayers(msg.players || {});
        } else if (msg.type === 'damage') {
            if (msg.target_id === this.playerId) {
                this.player.setData('hp', Math.max(0, msg.target_hp));
                this.damageEffect(this.player, { x: msg.attacker_x || 0, y: msg.attacker_y || 0, body: null });
                this.updateUI();
                if (msg.killed) this.playerDeath();
            }
            if (msg.attacker_id === this.playerId && msg.killed) {
                this.player.setData('kills', this.player.getData('kills') + 1);
                this.updateUI();
            }
            // Скрыть убитого удалённого игрока на нашем экране
            if (msg.killed && msg.target_id !== this.playerId) {
                const rp = this.remotePlayers[msg.target_id];
                if (rp) {
                    rp.sprite.setData('alive', false).setData('hp', 0);
                    rp.sprite.setVisible(false);
                    if (rp.sprite.body) rp.sprite.body.enable = false;
                    rp.label.setVisible(false);
                }
            }
        } else if (msg.type === 'player_left') {
            this.removeRemotePlayer(msg.player_id);
        } else if (msg.type === 'state_change') {
            this.clearRemotePlayers();
            document.getElementById('upgrade-overlay').classList.add('hidden');
            if (this.upgradeTimer) { clearTimeout(this.upgradeTimer); this.upgradeTimer = null; }
            for (const bot of this.bots) { bot.label.destroy(); }
            this.bots = [];
            if (this.botGroup) this.botGroup.destroy(true);
            this.botGroup = this.physics.add.group();
            this.enemyTargets = [];
            if (this.botGraphics) this.botGraphics.destroy();
            this.energyFragments = [];
            this.energyRespawnQueue = [];
            if (this.energyGraphics) this.energyGraphics.destroy();
            this.player.setData('level', 1).setData('exp', 0).setData('expToNext', 100);
            this.player.setData('damage', ATTACK_DAMAGE).setData('speed', PLAYER_SPEED);
            this.player.setData('maxHp', 100).setData('hp', 100).setData('kills', 0);
            this.respawnPlayer();
            this.createEnergyFragments();
            this.createBots();
            if (this.attackCone) this.attackCone.destroy();
            if (this.attackFlash) this.attackFlash.destroy();
            this.createAttackCone();
            this.physics.add.collider(this.player, this.botGroup);
            this.physics.add.collider(this.botGroup, this.botGroup);
            this.updateUI();
        }
    }

    sendWs(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    updateRemotePlayers(playersData) {
        // Remove disconnected players
        const remoteIds = Object.keys(this.remotePlayers);
        for (const rid of remoteIds) {
            if (!playersData[rid]) this.removeRemotePlayer(rid);
        }

        for (const [pid, pd] of Object.entries(playersData)) {
            if (pid === this.playerId) continue;
            let rp = this.remotePlayers[pid];
            if (!rp) {
                const x = pd.x || 0, y = pd.y || 0;
                const s = (PLAYER_RADIUS + 4) * 2;
                const mid = s / 2;
                const gfx = this.make.graphics({ add: false });
                gfx.fillStyle(PLAYER_COLOR, 0.3);
                gfx.fillCircle(mid, mid, PLAYER_RADIUS + 2);
                gfx.fillStyle(0x22c55e, 1);
                gfx.fillCircle(mid, mid, PLAYER_RADIUS);
                gfx.fillStyle(0x16a34a, 1);
                gfx.fillCircle(mid, mid, PLAYER_RADIUS - 5);
                gfx.generateTexture('remote_tex', s, s);
                gfx.destroy();

                const sprite = this.physics.add.sprite(x, y, 'remote_tex');
                sprite.body.setCircle(PLAYER_RADIUS, (s / 2) - PLAYER_RADIUS, (s / 2) - PLAYER_RADIUS);
                sprite.body.moves = false;
                sprite.setDepth(8);
                sprite.setData('hp', pd.hp || 100).setData('maxHp', pd.max_hp || 100);
                sprite.setData('alive', pd.alive !== false);

                const label = this.add.text(x, y - PLAYER_RADIUS - 14, pd.name || '?', {
                    fontSize: '12px', color: '#22c55e', fontFamily: 'Arial',
                    stroke: '#000000', strokeThickness: 2,
                }).setOrigin(0.5).setDepth(9);

                // Check if remote player was attacking us — add to targets
                this.addTarget(sprite);

                rp = { sprite, label, id: pid, prevPos: { x, y }, targetPos: { x, y }, interpT: 1 };
                this.remotePlayers[pid] = rp;
            } else {
                rp.sprite.setData('hp', pd.hp !== undefined ? pd.hp : 100).setData('maxHp', pd.max_hp !== undefined ? pd.max_hp : 100);
                rp.sprite.setData('alive', pd.alive !== false);
            }

            rp = this.remotePlayers[pid];
            if (!rp) continue;
            const pdVal = playersData[pid];
            if (!rp.sprite.getData('alive')) {
                rp.sprite.setVisible(false);
                if (rp.sprite.body) rp.sprite.body.enable = false;
                rp.label.setVisible(false);
                continue;
            }
            rp.sprite.setVisible(true);
            if (rp.sprite.body) rp.sprite.body.enable = true;
            rp.label.setVisible(true);
            // Set interpolation target instead of snapping position
            rp.prevPos = { x: rp.sprite.x, y: rp.sprite.y };
            rp.targetPos = { x: pdVal.x, y: pdVal.y };
            rp.interpT = 0;
        }
    }

    removeRemotePlayer(pid) {
        const rp = this.remotePlayers[pid];
        if (rp) {
            this.removeTarget(rp.sprite);
            rp.sprite.destroy();
            rp.label.destroy();
            delete this.remotePlayers[pid];
        }
    }

    clearRemotePlayers() {
        for (const pid of Object.keys(this.remotePlayers)) {
            this.removeRemotePlayer(pid);
        }
    }

    playerDeath() {
        this.player.setData('alive', false);
        this.player.setVelocity(0, 0);

        // Reset progress on death
        this.player.setData('level', 1);
        this.player.setData('exp', 0);
        this.player.setData('expToNext', XP_BASE);
        this.player.setData('kills', 0);
        this.player.setData('damage', ATTACK_DAMAGE);
        this.player.setData('speed', PLAYER_SPEED);
        this.player.setData('maxHp', 100);
        this.player.setData('hp', 0);

        const overlay = document.getElementById('death-overlay');
        overlay.classList.remove('hidden');
        document.getElementById('death-info').textContent =
            `Level 1 | Kills: 0`;

        this.dropEnergyOnDeath(this.player.x, this.player.y);
        this.updateUI();

        this.time.delayedCall(500, () => {
            this.player.setVisible(false);
            this.player.body.enable = false;
            this.playerLabel.setVisible(false);
            this.attackCone.clear();
            this.attackFlash.clear();
            this.flashTimer = 0;
        });
    }

    respawnPlayer() {
        this.stunTimer = 0;
        this.joystickDir = { x: 0, y: 0 };
        this.player.setData('alive', true);
        this.player.setData('hp', this.player.getData('maxHp'));
        this.player.setPosition(
            Phaser.Math.Between(100, ARENA_WIDTH - 100),
            Phaser.Math.Between(100, ARENA_HEIGHT - 100)
        );
        this.player.setVelocity(0, 0);
        this.player.setVisible(true);
        this.player.body.enable = true;
        this.playerLabel.setVisible(true);
        this.player.clearTint();
        this.updateUI();
    }

    damageEffect(target, attacker) {
        const angle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
        target.body.setVelocity(
            Math.cos(angle) * KNOCKBACK_FORCE,
            Math.sin(angle) * KNOCKBACK_FORCE
        );
        if (target === this.player) {
            this.stunTimer = 150;
        } else {
            target.setData('stunTimer', 150);
        }
        target.setTint(0xff0000);
        this.time.delayedCall(100, () => {
            if (target.active) target.clearTint();
        });
    }

    createEnergyFragments() {
        for (let i = 0; i < ENERGY_FRAGMENTS_COUNT; i++) {
            this.energyFragments.push(this.spawnEnergyFragment());
        }
        this.energyGraphics = this.add.graphics();
        this.energyGraphics.setDepth(5);
    }

    spawnEnergyFragment() {
        return {
            x: Phaser.Math.Between(100, ARENA_WIDTH - 100),
            y: Phaser.Math.Between(100, ARENA_HEIGHT - 100),
            value: Phaser.Math.Between(5, 20),
        };
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
            if (Phaser.Math.Distance.Between(px, py, frag.x, frag.y) < ENERGY_PICKUP_RANGE) {
                this.collectFragment(i);
            }
        }
    }

    collectFragment(index, collector) {
        const frag = this.energyFragments[index];
        this.energyFragments.splice(index, 1);

        this.energyRespawnQueue.push({
            delay: Phaser.Math.Between(ENERGY_RESPAWN_DELAY.min, ENERGY_RESPAWN_DELAY.max),
            timer: 0,
        });

        if (collector === this.player || !collector) {
            this.collectFlashTimer = 200;
            this.addExp(frag.value, this.player);
        } else if (collector.getData) {
            this.botAddExp(collector, frag.value);
        }
    }

    addExp(amount, who) {
        let exp = who.getData('exp') + amount;
        let level = who.getData('level');
        let expToNext = who.getData('expToNext');

        while (exp >= expToNext) {
            exp -= expToNext;
            level++;
            expToNext = XP_BASE + (level - 1) * XP_SCALE;
            this.levelUpTimer = 500;
            if (level % 5 === 0) this.showUpgradeChoice();
        }

        who.setData('exp', exp);
        who.setData('level', level);
        who.setData('expToNext', expToNext);
        if (who === this.player) this.updateUI();
    }

    botAddExp(sprite, amount) {
        let exp = (sprite.getData('exp') || 0) + amount;
        let level = sprite.getData('level');
        let expToNext = sprite.getData('expToNext');

        while (exp >= expToNext) {
            exp -= expToNext;
            level++;
            expToNext = XP_BASE + (level - 1) * XP_SCALE;
            if (level % 5 === 0) this.botLevelUp(sprite);
        }

        sprite.setData('exp', exp);
        sprite.setData('level', level);
        sprite.setData('expToNext', expToNext);
    }

    botLevelUp(sprite) {
        const stats = ['damage', 'maxHp', 'speed'];
        const stat = stats[Math.floor(Math.random() * stats.length)];
        if (stat === 'damage') sprite.setData('damage', sprite.getData('damage') + 5);
        else if (stat === 'maxHp') {
            sprite.setData('maxHp', sprite.getData('maxHp') + 25);
            sprite.setData('hp', sprite.getData('maxHp'));
        } else if (stat === 'speed') sprite.setData('speed', Math.min(300, sprite.getData('speed') + 15));
    }

    showUpgradeChoice() {
        document.getElementById('upgrade-overlay').classList.remove('hidden');
        if (this.upgradeTimer) clearTimeout(this.upgradeTimer);
        this.upgradeTimer = setTimeout(() => {
            const btns = document.querySelectorAll('.upgrade-btn');
            if (btns.length > 0) {
                const idx = Math.floor(Math.random() * btns.length);
                this.applyUpgrade(btns[idx].dataset.stat);
            }
        }, 5000);
    }

    applyUpgrade(stat) {
        if (this.upgradeTimer) { clearTimeout(this.upgradeTimer); this.upgradeTimer = null; }
        document.getElementById('upgrade-overlay').classList.add('hidden');
        if (stat === 'damage') this.player.setData('damage', this.player.getData('damage') + 5);
        else if (stat === 'maxHp') {
            this.player.setData('maxHp', this.player.getData('maxHp') + 25);
            this.player.setData('hp', Math.min(this.player.getData('hp') + 25, this.player.getData('maxHp')));
        } else if (stat === 'speed') this.player.setData('speed', Math.min(300, this.player.getData('speed') + 15));
        this.updateUI();
    }

    returnToBattle() {
        document.getElementById('death-overlay').classList.add('hidden');
        this.respawnPlayer();
        this.sendWs({ action: 'respawn' });
    }

    changeMap() {
        document.getElementById('death-overlay').classList.add('hidden');
        this.sendWs({ action: 'change_map' });
    }

    createPlayer() {
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

        this.player = this.physics.add.sprite(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 'player_tex');
        this.player.body.setCircle(PLAYER_RADIUS, (s / 2) - PLAYER_RADIUS, (s / 2) - PLAYER_RADIUS);
        this.player.body.setCollideWorldBounds(true);
        this.player.setDepth(10);
        this.player.setData('hp', 100).setData('maxHp', 100).setData('level', 1);
        this.player.setData('exp', 0).setData('expToNext', 100);
        this.player.setData('damage', ATTACK_DAMAGE).setData('speed', PLAYER_SPEED).setData('kills', 0);
        this.player.setData('alive', true);
        this.player.setData('atkCooldown', ATTACK_COOLDOWN).setData('atkRange', ATTACK_RANGE);
        this.player.setData('atkAngle', ATTACK_ANGLE).setData('atkFlashDuration', ATTACK_FLASH_DURATION);

        this.playerLabel = this.add.text(ARENA_WIDTH / 2, ARENA_HEIGHT / 2 - PLAYER_RADIUS - 14,
            playerData?.first_name || 'Player', {
                fontSize: '13px', color: '#ffffff', fontFamily: 'Arial',
                stroke: '#000000', strokeThickness: 3,
            }).setOrigin(0.5).setDepth(11);

        this.updateUI();
    }

    createAttackCone() {
        this.attackCone = this.add.graphics().setDepth(9);
        this.attackFlash = this.add.graphics().setDepth(9);
    }

    drawCone(g, px, py, angle, range, angleSize, alpha) {
        g.clear();
        const ha = angleSize / 2;
        g.fillStyle(0x9b59b6, alpha * 0.12);
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + Math.cos(angle - ha) * range, py + Math.sin(angle - ha) * range);
        g.arc(px, py, range, angle - ha, angle + ha, false);
        g.closePath();
        g.fillPath();
        g.lineStyle(2, 0x9b59b6, alpha * 0.35);
        g.beginPath();
        g.arc(px, py, range, angle - ha, angle + ha, false);
        g.strokePath();
        g.lineStyle(1, 0x9b59b6, alpha * 0.25);
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + Math.cos(angle - ha) * range, py + Math.sin(angle - ha) * range);
        g.moveTo(px, py);
        g.lineTo(px + Math.cos(angle + ha) * range, py + Math.sin(angle + ha) * range);
        g.strokePath();
    }

    drawFlash(g, px, py, angle, range, angleSize, progress) {
        g.clear();
        const ha = angleSize / 2;
        const alpha = 1 - progress;
        const r = range * (1 + progress * 0.3);
        g.fillStyle(0xffffff, alpha * 0.4);
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + Math.cos(angle - ha) * r, py + Math.sin(angle - ha) * r);
        g.arc(px, py, r, angle - ha, angle + ha, false);
        g.closePath();
        g.fillPath();
        g.lineStyle(3, 0xffffff, alpha * 0.6);
        g.beginPath();
        g.arc(px, py, r, angle - ha, angle + ha, false);
        g.strokePath();
    }

    performAttack() {
        const px = this.player.x, py = this.player.y;
        const dmg = this.player.getData('damage');
        const atkRange = this.player.getData('atkRange');
        const atkAngle = this.player.getData('atkAngle');
        const atkFlashDuration = this.player.getData('atkFlashDuration');
        this.flashTimer = atkFlashDuration;

        for (let i = this.enemyTargets.length - 1; i >= 0; i--) {
            const t = this.enemyTargets[i];
            if (!t.active || !t.getData('alive')) continue;
            const dx = t.x - px, dy = t.y - py;
            if (Math.sqrt(dx * dx + dy * dy) > atkRange) continue;
            let diff = Math.atan2(dy, dx) - this.facingAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) <= atkAngle / 2) {
                // Remote player hit → send to server
                const rpEntry = Object.entries(this.remotePlayers).find(([, rp]) => rp.sprite === t);
                if (rpEntry) {
                    this.sendWs({ action: 'attack', target_id: rpEntry[0], x: this.player.x, y: this.player.y });
                    this.damageEffect(t, this.player);
                    continue;
                }
                const newHp = t.getData('hp') - dmg;
                t.setData('hp', newHp);
                this.damageEffect(t, this.player);
                    if (newHp <= 0) {
                    t.setData('alive', false);
                    t.setVisible(false);
                    t.body.enable = false;
                    const deadBot = this.bots.find(b => b.sprite === t);
                    if (deadBot) { deadBot.label.setVisible(false); deadBot.respawnTimer = Phaser.Math.Between(BOT_RESPAWN_DELAY.min, BOT_RESPAWN_DELAY.max); }
                    this.player.setData('kills', this.player.getData('kills') + 1);
                    this.addExp(XP_PER_KILL, this.player);
                    this.updateUI();
                    this.dropEnergyOnDeath(t.x, t.y);
                }
            }
        }
    }

    isInAttackCone(x, y) {
        const dx = x - this.player.x, dy = y - this.player.y;
        const atkRange = this.player.getData('atkRange');
        const atkAngle = this.player.getData('atkAngle');
        if (Math.sqrt(dx * dx + dy * dy) > atkRange) return false;
        let diff = Math.atan2(dy, dx) - this.facingAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return Math.abs(diff) <= atkAngle / 2;
    }

    addTarget(sprite) {
        if (sprite.getData('hp') === undefined) sprite.setData('hp', 50);
        if (sprite.getData('alive') === undefined) sprite.setData('alive', true);
        this.enemyTargets.push(sprite);
    }

    removeTarget(sprite) {
        const idx = this.enemyTargets.indexOf(sprite);
        if (idx !== -1) this.enemyTargets.splice(idx, 1);
    }

    dropEnergyOnDeath(x, y) {
        const count = Phaser.Math.Between(2, 4);
        for (let i = 0; i < count; i++) {
            this.energyFragments.push({
                x: x + Phaser.Math.Between(-20, 20),
                y: y + Phaser.Math.Between(-20, 20),
                value: Phaser.Math.Between(3, 8),
            });
        }
    }

    spawnBot() {
        const bot = {};

        let name;
        const used = new Set();
        for (const b of this.bots) if (b.name) used.add(b.name);
        let attempts = 0;
        do {
            name = generateBotName();
            attempts++;
        } while (used.has(name) && attempts < 100);

        if (!this.textures.exists('bot_tex')) {
            const s = (BOT_RADIUS + 6) * 2;
            const gfx = this.make.graphics({ add: false });
            const mid = s / 2;
            gfx.fillStyle(0xffffff, 0.1);
            gfx.fillCircle(mid, mid, BOT_RADIUS + 3);
            gfx.fillStyle(BOT_COLOR, 1);
            gfx.fillCircle(mid, mid, BOT_RADIUS);
            gfx.fillStyle(0x991b1b, 1);
            gfx.fillCircle(mid, mid, BOT_RADIUS - 5);
            gfx.lineStyle(2, 0xffffff, 0.15);
            gfx.strokeCircle(mid, mid, BOT_RADIUS - 1);
            gfx.generateTexture('bot_tex', s, s);
            gfx.destroy();
        }

        const s = (BOT_RADIUS + 6) * 2;
        const x = Phaser.Math.Between(100, ARENA_WIDTH - 100);
        const y = Phaser.Math.Between(100, ARENA_HEIGHT - 100);

        const sprite = this.physics.add.sprite(x, y, 'bot_tex');
        sprite.body.setCircle(BOT_RADIUS, (s / 2) - BOT_RADIUS, (s / 2) - BOT_RADIUS);
        sprite.body.setCollideWorldBounds(true);
        sprite.setDepth(5);
        sprite.setData('hp', 100);
        sprite.setData('maxHp', 100);
        sprite.setData('alive', true);
        sprite.setData('level', 1);
        sprite.setData('damage', ATTACK_DAMAGE);
        sprite.setData('speed', PLAYER_SPEED);
        sprite.setData('exp', 0).setData('expToNext', XP_BASE);
        if (this.botGroup) this.botGroup.add(sprite);

        const label = this.add.text(x, y - BOT_RADIUS - 12, name, {
            fontSize: '11px', color: '#ff6b6b', fontFamily: 'Arial',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(6);

        this.addTarget(sprite);

        bot.sprite = sprite;
        bot.label = label;
        bot.name = name;
        bot.aiTimer = Phaser.Math.Between(100, 500);
        bot.attackTimer = Phaser.Math.Between(0, BOT_ATTACK_COOLDOWN);
        bot.respawnTimer = 0;
        bot.state = 'roam';
        bot.targetX = x;
        bot.targetY = y;

        this.bots.push(bot);
        return bot;
    }

    createBots() {
        this.botGraphics = this.add.graphics().setDepth(6);

        for (let i = 0; i < BOT_COUNT; i++) {
            this.spawnBot();
        }
    }

    respawnBot(bot) {
        const used = new Set();
        for (const b of this.bots) if (b.name) used.add(b.name);
        let name;
        let attempts = 0;
        do {
            name = generateBotName();
            attempts++;
        } while (used.has(name) && attempts < 100);
        bot.name = name;
        bot.label.setText(name);

        bot.sprite.setData('hp', bot.sprite.getData('maxHp'));
        bot.sprite.setData('alive', true);
        bot.sprite.setPosition(
            Phaser.Math.Between(100, ARENA_WIDTH - 100),
            Phaser.Math.Between(100, ARENA_HEIGHT - 100)
        );
        bot.sprite.setVelocity(0, 0);
        bot.sprite.setAlpha(1);
        bot.sprite.setVisible(true);
        if (bot.sprite.body) bot.sprite.body.enable = true;
        bot.label.setVisible(true);
        bot.aiTimer = Phaser.Math.Between(100, 500);
        bot.attackTimer = Phaser.Math.Between(0, BOT_ATTACK_COOLDOWN);
        bot.state = 'roam';
    }

    updateBotAI(bot, delta) {
        const s = bot.sprite;
        if (!s.active || !s.getData('alive')) return;

        const sx = s.x, sy = s.y;
        const speed = s.getData('speed');

        // Attack cooldown runs every frame
        if (bot.state === 'attack') {
            bot.attackTimer -= delta;
            if (bot.attackTimer <= 0) {
                bot.attackTimer = BOT_ATTACK_COOLDOWN;
                let target = null;
                let targetDist = Infinity;
                if (this.player.getData('alive')) {
                    const d = Phaser.Math.Distance.Between(sx, sy, this.player.x, this.player.y);
                    if (d < targetDist && d < BOT_ATTACK_RANGE) { targetDist = d; target = this.player; }
                }
                if (!target) {
                    for (const other of this.bots) {
                        if (other === bot || !other.sprite.getData('alive')) continue;
                        const d = Phaser.Math.Distance.Between(sx, sy, other.sprite.x, other.sprite.y);
                        if (d < targetDist && d < BOT_ATTACK_RANGE) { targetDist = d; target = other.sprite; }
                    }
                }
                if (target && target.getData('alive')) {
                    const nhp = target.getData('hp') - s.getData('damage');
                    target.setData('hp', nhp);
                    this.damageEffect(target, s);
                    if (target === this.player) {
                        this.updateUI();
                        if (nhp <= 0) {
                            this.botAddExp(s, XP_PER_KILL);
                            this.playerDeath();
                        }
                    } else {
                        if (nhp <= 0) {
                            target.setData('alive', false);
                            target.setVisible(false);
                            if (target.body) target.body.enable = false;
                            const deadBot = this.bots.find(b => b.sprite === target);
                    if (deadBot) { deadBot.label.setVisible(false); deadBot.respawnTimer = Phaser.Math.Between(BOT_RESPAWN_DELAY.min, BOT_RESPAWN_DELAY.max); }
                            this.botAddExp(s, XP_PER_KILL);
                            this.dropEnergyOnDeath(target.x, target.y);
                        }
                    }
                }
            }
        }

        // AI decisions only when aiTimer expires
        bot.aiTimer -= delta;
        if (bot.aiTimer > 0) {
            this.botMove(bot);
            return;
        }

        bot.aiTimer = Phaser.Math.Between(BOT_AI_INTERVAL.min, BOT_AI_INTERVAL.max);

        const hp = s.getData('hp');
        const maxHp = s.getData('maxHp');

        let nearestEnemy = null;
        let nearestEnemyDist = Infinity;
        let nearestEnergy = null;
        let nearestEnergyDist = Infinity;

        if (this.player.getData('alive')) {
            const d = Phaser.Math.Distance.Between(sx, sy, this.player.x, this.player.y);
            if (d < nearestEnemyDist) { nearestEnemyDist = d; nearestEnemy = this.player; }
        }
        for (const other of this.bots) {
            if (other === bot || !other.sprite.getData('alive')) continue;
            const d = Phaser.Math.Distance.Between(sx, sy, other.sprite.x, other.sprite.y);
            if (d < nearestEnemyDist) { nearestEnemyDist = d; nearestEnemy = other.sprite; }
        }

        for (const frag of this.energyFragments) {
            const d = Phaser.Math.Distance.Between(sx, sy, frag.x, frag.y);
            if (d < nearestEnergyDist) { nearestEnergyDist = d; nearestEnergy = frag; }
        }

        bot.state = 'roam';
        bot.targetX = sx + Phaser.Math.Between(-200, 200);
        bot.targetY = sy + Phaser.Math.Between(-200, 200);

        if (hp / maxHp < BOT_FLEE_HP_RATIO && nearestEnemy && nearestEnemyDist < 200) {
            bot.state = 'flee';
            const angle = Math.atan2(sy - nearestEnemy.y, sx - nearestEnemy.x);
            bot.targetX = sx + Math.cos(angle) * 300;
            bot.targetY = sy + Math.sin(angle) * 300;
        } else if (nearestEnemy && nearestEnemyDist < BOT_ATTACK_RANGE) {
            bot.state = 'attack';
            bot.targetX = nearestEnemy.x;
            bot.targetY = nearestEnemy.y;
        } else if (nearestEnemy && nearestEnemyDist < BOT_CHASE_RANGE) {
            bot.state = 'chase';
            bot.targetX = nearestEnemy.x;
            bot.targetY = nearestEnemy.y;
        } else if (nearestEnergy && nearestEnergyDist < BOT_SEEK_RANGE) {
            bot.state = 'seek';
            bot.targetX = nearestEnergy.x;
            bot.targetY = nearestEnergy.y;
        }

        bot.targetX = Phaser.Math.Clamp(bot.targetX, 50, ARENA_WIDTH - 50);
        bot.targetY = Phaser.Math.Clamp(bot.targetY, 50, ARENA_HEIGHT - 50);

        this.botMove(bot);
    }

    botMove(bot) {
        const s = bot.sprite;
        if (s.getData('stunTimer') > 0) { return; }
        const sx = s.x, sy = s.y;
        const speed = s.getData('speed');
        const dx = bot.targetX - sx, dy = bot.targetY - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        if (bot.state === 'attack' && dist < BOT_ATTACK_RANGE * 0.9) {
            s.setVelocity(0, 0);
        } else {
            s.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        }
        s.setRotation(angle + Math.PI / 2);
    }

    updateBotEnergyPickup(bot) {
        const s = bot.sprite;
        if (!s.getData('alive')) return;

        for (let i = this.energyFragments.length - 1; i >= 0; i--) {
            const frag = this.energyFragments[i];
            if (Phaser.Math.Distance.Between(s.x, s.y, frag.x, frag.y) < ENERGY_PICKUP_RANGE) {
                this.collectFragment(i, s);
                break;
            }
        }
    }

    drawBotBars() {
        this.botGraphics.clear();

        for (const bot of this.bots) {
            const s = bot.sprite;
            if (!s.getData('alive')) continue;

            const x = s.x, y = s.y - BOT_RADIUS - 8;
            const hp = s.getData('hp'), maxHp = s.getData('maxHp');
            const w = 30, h = 4;
            const pct = Math.max(0, hp / maxHp);

            this.botGraphics.fillStyle(0x000000, 0.6);
            this.botGraphics.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
            this.botGraphics.fillStyle(0xdc2626, 1);
            this.botGraphics.fillRect(x - w / 2, y, w * pct, h);

            bot.label.setPosition(s.x, s.y - BOT_RADIUS - 14);
        }
    }

    createJoystick() {
        this.joystickBase = this.add.graphics().setDepth(100).setScrollFactor(0);
        this.joystickThumb = this.add.graphics().setDepth(101).setScrollFactor(0);
        this.joystick = { x: 0, y: 0 };
        this.joystickActive = false;
        this.joystickDir = { x: 0, y: 0 };
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
        if (this.joystickPointerId !== null) return;
        if (!this.player || !this.player.getData('alive') || pointer.y < 80) return;
        this.joystickPointerId = pointer.id;
        this.joystick.x = pointer.x;
        this.joystick.y = pointer.y;
        this.drawJoystickBase(pointer.x, pointer.y);
        this.drawJoystickThumb(pointer.x, pointer.y);
        this.joystickActive = true;
    }

    onPointerMove(pointer) {
        if (this.joystickActive && pointer.isDown) this.updateJoystick(pointer);
    }

    onPointerUp(pointer) {
        if (pointer.id !== this.joystickPointerId) return;
        this.joystickPointerId = null;
        this.joystickActive = false;
        this.joystickDir = { x: 0, y: 0 };
        if (this.player && this.player.body) this.player.setVelocity(0, 0);
        this.joystickBase.clear();
        this.joystickThumb.clear();
    }

    updateJoystick(pointer) {
        let dx = pointer.x - this.joystick.x, dy = pointer.y - this.joystick.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = JOYSTICK_BASE_RADIUS;
        let clampedDist = Math.min(dist, maxDist);
        let nx = dx / (dist || 1), ny = dy / (dist || 1);
        if (dist > maxDist) { dx = nx * maxDist; dy = ny * maxDist; }
        this.joystickThumb.clear();
        this.drawJoystickThumb(this.joystick.x + dx, this.joystick.y + dy);
        if (dist > 15) {
            this.joystickDir = { x: nx * (clampedDist / maxDist), y: ny * (clampedDist / maxDist) };
            this.facingAngle = Math.atan2(dy, dx);
        } else {
            this.joystickDir = { x: 0, y: 0 };
        }
    }

    updateUI() {
        const h = this.player.getData('hp'), m = this.player.getData('maxHp');
        const l = this.player.getData('level'), e = this.player.getData('exp'), en = this.player.getData('expToNext');
        const k = this.player.getData('kills');

        document.getElementById('player-level').textContent = `Lv. ${l}`;
        document.getElementById('hp-fill').style.width = `${Math.max(0, h / m * 100)}%`;
        document.getElementById('hp-text').textContent = `${Math.max(0, h)}/${m}`;
        document.getElementById('exp-fill').style.width = `${Math.min(100, e / en * 100)}%`;
        document.getElementById('exp-text').textContent = `${e}/${en}`;
        document.getElementById('kill-counter').textContent = `Kills: ${k}`;
    }

    update(time, delta) {
        if (!this.player) return;

        // Keyboard input (desktop)
        let kx = 0, ky = 0;
        if (this.cursors && this.wasd) {
            if (this.cursors.left.isDown || this.wasd.A.isDown) kx = -1;
            if (this.cursors.right.isDown || this.wasd.D.isDown) kx = 1;
            if (this.cursors.up.isDown || this.wasd.W.isDown) ky = -1;
            if (this.cursors.down.isDown || this.wasd.S.isDown) ky = 1;
        }
        if (kx !== 0 || ky !== 0) {
            const len = Math.sqrt(kx * kx + ky * ky);
            this.joystickDir = { x: kx / len, y: ky / len };
            this.facingAngle = Math.atan2(ky, kx);
        }

        // Player death overlay visible — game still runs
        if (!this.player.getData('alive')) {
            // Skip player logic, bots/energy still process below
        } else {
            this.playerLabel.setPosition(this.player.x, this.player.y - PLAYER_RADIUS - 14);

            const speed = this.player.getData('speed');
            if (this.stunTimer > 0) {
                this.stunTimer -= delta;
            } else {
                this.player.setVelocity(this.joystickDir.x * speed, this.joystickDir.y * speed);
                if (this.joystickDir.x !== 0 || this.joystickDir.y !== 0) {
                    this.player.setRotation(this.facingAngle + Math.PI / 2);
                }
            }

            const px = this.player.x, py = this.player.y;

            const atkRange = this.player.getData('atkRange');
            const atkAngle = this.player.getData('atkAngle');
            this.drawCone(this.attackCone, px, py, this.facingAngle, atkRange, atkAngle, 1);

            if (this.flashTimer > 0) {
                this.flashTimer -= delta;
                const atkRange = this.player.getData('atkRange');
                const atkAngle = this.player.getData('atkAngle');
                const atkFlashDuration = this.player.getData('atkFlashDuration');
                const p = 1 - this.flashTimer / atkFlashDuration;
                this.drawFlash(this.attackFlash, px, py, this.facingAngle, atkRange, atkAngle, Math.min(1, Math.max(0, p)));
            } else {
                this.attackFlash.clear();
            }

            this.attackTimer -= delta;
            if (this.attackTimer <= 0) {
                this.attackTimer = this.player.getData('atkCooldown');
                this.performAttack();
            }
        }

        this.drawEnergyFragments();
        if (this.player.getData('alive')) {
            this.checkEnergyPickup();
            // Send position to server
            this.sendMoveTimer -= delta;
            if (this.sendMoveTimer <= 0) {
                this.sendMoveTimer = 50;
                const px = this.player.x, py = this.player.y;
                const angleChanged = Math.abs(this.facingAngle - this.lastSentAngle) > 0.1;
                if (Math.abs(px - this.lastSentPos.x) > 5 || Math.abs(py - this.lastSentPos.y) > 5 || angleChanged) {
                    this.lastSentPos = { x: px, y: py };
                    this.lastSentAngle = this.facingAngle;
                    this.sendWs({ action: 'move', x: px, y: py, angle: this.facingAngle });
                }
            }
        }

        const px = this.player.x, py = this.player.y;

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

        for (let i = this.energyRespawnQueue.length - 1; i >= 0; i--) {
            this.energyRespawnQueue[i].timer += delta;
            if (this.energyRespawnQueue[i].timer >= this.energyRespawnQueue[i].delay) {
                this.energyFragments.push(this.spawnEnergyFragment());
                this.energyRespawnQueue.splice(i, 1);
            }
        }

        // Remote player interpolation
        for (const rp of Object.values(this.remotePlayers)) {
            if (rp.interpT < 1) {
                rp.interpT += delta / 50;
                if (rp.interpT > 1) rp.interpT = 1;
                const t = rp.interpT;
                rp.sprite.setPosition(
                    rp.prevPos.x + (rp.targetPos.x - rp.prevPos.x) * t,
                    rp.prevPos.y + (rp.targetPos.y - rp.prevPos.y) * t
                );
            } else {
                rp.sprite.setPosition(rp.targetPos.x, rp.targetPos.y);
            }
            rp.label.setPosition(rp.sprite.x, rp.sprite.y - PLAYER_RADIUS - 14);
        }

        for (const bot of this.bots) {
            if (!bot.sprite.getData('alive')) {
                bot.respawnTimer -= delta;
                if (bot.respawnTimer <= 0) {
                    this.respawnBot(bot);
                }
                continue;
            }
            const stun = bot.sprite.getData('stunTimer') || 0;
            if (stun > 0) bot.sprite.setData('stunTimer', Math.max(0, stun - delta));
            this.updateBotAI(bot, delta);
            this.updateBotEnergyPickup(bot);
        }
        this.drawBotBars();

        for (const bot of this.bots) {
            if (!bot.sprite.getData('alive') && (bot.respawnTimer === undefined || bot.respawnTimer <= 0 || isNaN(bot.respawnTimer))) {
                bot.respawnTimer = Phaser.Math.Between(BOT_RESPAWN_DELAY.min, BOT_RESPAWN_DELAY.max);
            }
        }
        this.drawRemoteBars();
    }

    drawRemoteBars() {
        for (const rp of Object.values(this.remotePlayers)) {
            const s = rp.sprite;
            if (!s.getData('alive') || !s.visible) continue;
            const hp = s.getData('hp'), maxHp = s.getData('maxHp');
            if (maxHp <= 0) continue;
            const pct = Math.max(0, hp / maxHp);
            const x = s.x, y = s.y - PLAYER_RADIUS - 8;
            const w = 30, h = 4;
            this.energyGraphics.fillStyle(0x000000, 0.6);
            this.energyGraphics.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
            this.energyGraphics.fillStyle(0x22c55e, 1);
            this.energyGraphics.fillRect(x - w / 2, y, w * pct, h);
        }
    }

    resize() {
        const w = this.scale.width, h = this.scale.height;
        this.cameras.main.setSize(w, h);
    }
}

document.addEventListener('DOMContentLoaded', initTelegram);

window.__gameLoaded = true;
