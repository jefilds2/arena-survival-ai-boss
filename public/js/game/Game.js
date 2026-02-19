// public/js/game/Game.js
import { CFG } from "./constants.js";
import { Input } from "./input.js";
import { circlesHit } from "./systems/collision.js";
import { spawnEnemyFromEdge } from "./systems/spawner.js";
import { showLevelUp, hideLevelUp } from "./ui/levelup.js";

import { Player } from "./entities/Player.js";
import { Enemy } from "./entities/Enemy.js";
import { Bullet } from "./entities/Bullet.js";
import { Orb } from "./entities/Orb.js";
import { Boss } from "./entities/Boss.js";

import { BossAIClient } from "./ia/bossAiClient.js";
import { fromAngle } from "./math.js";

export class Game {
    constructor({ canvas, renderer, hud } = {}) {
        this.renderer = renderer || null;
        this.canvas = canvas;
        this.hud = hud || null;

        this.ctx = this.renderer ? null : this.canvas.getContext("2d");

        this.input = new Input();
        this.ai = new BossAIClient();

        this._bossDecision = null;
        this._bossDecisionPromise = null;

        // ✅ throttle da IA
        this._nextAiThinkAt = 0;

        this.levelPanel = document.getElementById("levelup");
        this.choicesEl = document.getElementById("choices");

        this.stage = CFG.stages?.start ?? 1;
        this.diff = this._computeDifficulty();

        this._ensureEndOverlay();

        window.addEventListener("keydown", (e) => {
            const k = e.key.toLowerCase();
            if (k === "i") this.ai.toggle?.();
            if (k === "r") this.reset();
        });

        this._bindResize();
        this.reset();
    }

    _bindResize() {
        const resize = () => {
            this.w = this.canvas.clientWidth || 960;
            this.h = this.canvas.clientHeight || 540;

            if (!this.renderer && this.ctx) {
                const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
                this.canvas.width = Math.floor(this.w * dpr);
                this.canvas.height = Math.floor(this.h * dpr);
                this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        };

        const ro = new ResizeObserver(resize);
        ro.observe(this.canvas);
        resize();
    }

    _ensureEndOverlay() {
        let el = document.getElementById("endOverlay");
        if (!el) {
            el = document.createElement("div");
            el.id = "endOverlay";
            el.style.position = "absolute";
            el.style.inset = "0";
            el.style.display = "none";
            el.style.alignItems = "center";
            el.style.justifyContent = "center";
            el.style.background = "rgba(0,0,0,.55)";
            el.style.backdropFilter = "blur(2px)";
            el.style.zIndex = "50";
            el.style.pointerEvents = "auto";

            el.innerHTML = `
        <div style="
          width:min(560px,92vw);
          background:rgba(10,10,12,.85);
          border:1px solid rgba(255,255,255,.10);
          border-radius:16px;
          padding:18px 18px;
          box-shadow:0 20px 60px rgba(0,0,0,.55);
          font-family:system-ui;
          color:rgba(255,255,255,.92);
          text-align:center;
        ">
          <div id="endTitle" style="font-weight:800;font-size:22px;margin-bottom:6px;"></div>
          <div id="endSubtitle" style="opacity:.8;font-size:13px;margin-bottom:14px;">
            Pressione <b>R</b> para reiniciar
          </div>

          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button id="endNextBtn" style="
              display:none;
              padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.16);
              background:rgba(80,255,120,.12);color:rgba(255,255,255,.92);cursor:pointer;
              font-weight:800;
            ">Próximo Nível</button>

            <button id="endBtn" style="
              padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.16);
              background:rgba(255,255,255,.08);color:rgba(255,255,255,.92);cursor:pointer;
              font-weight:700;
            ">Reiniciar (R)</button>
          </div>
        </div>
      `;

            const root = document.getElementById("gameRoot") || document.body;
            root.style.position = root.style.position || "relative";
            root.appendChild(el);

            el.querySelector("#endBtn")?.addEventListener("click", () => this.reset());
            el.querySelector("#endNextBtn")?.addEventListener("click", () => this.nextStage());
        }

        this.endOverlay = el;
        this.endTitleEl = el.querySelector("#endTitle");
        this.endNextBtn = el.querySelector("#endNextBtn");
    }

    _showEndOverlay(text, { canNext = false } = {}) {
        if (!this.endOverlay) return;
        if (this.endTitleEl) this.endTitleEl.textContent = text || "FIM";
        if (this.endNextBtn) this.endNextBtn.style.display = canNext ? "inline-flex" : "none";
        this.endOverlay.style.display = "flex";
    }

    _hideEndOverlay() {
        if (!this.endOverlay) return;
        this.endOverlay.style.display = "none";
    }

    _computeDifficulty() {
        const s = Math.max(1, this.stage || 1);
        const k = Math.max(0, s - 1);
        const S = CFG.stages || {};

        const bossSpawnAt = Math.max(
            S.bossSpawnAtMin ?? 18,
            CFG.boss.spawnAt - k * (S.bossSpawnAtDecay ?? 2)
        );

        return {
            stage: s,
            enemyHpMul: 1 + k * (S.enemyHpGrowth ?? 0.14),
            enemySpeedMul: 1 + k * (S.enemySpeedGrowth ?? 0.04),
            enemyDmgMul: 1 + k * (S.enemyDmgGrowth ?? 0.10),

            spawnRateMul: 1 + k * (S.spawnRateGrowth ?? 0.08),
            maxAliveAdd: Math.round(k * (S.maxAliveGrowth ?? 2)),

            bossHpMul: 1 + k * (S.bossHpGrowth ?? 0.35),
            bossDmgMul: 1 + k * (S.bossDmgGrowth ?? 0.12),
            bossSpawnAt,
        };
    }

    _bossUnlockedPowers() {
        const unlocks = CFG.stages?.powerUnlocks ?? [];
        const set = new Set();

        for (const u of unlocks) {
            if ((this.stage || 1) >= (u.level ?? 999)) {
                for (const p of (u.powers ?? [])) set.add(String(p).toUpperCase());
            }
        }

        if (!set.size) {
            set.add("DASH");
            set.add("SHOOT_RING");
        }

        return [...set];
    }

    reset() {
        this.stage = CFG.stages?.start ?? 1;
        this.diff = this._computeDifficulty();

        this.time = 0;
        this.running = true;
        this.pausedForLevelUp = false;

        this.player = new Player(this.w * 0.5, this.h * 0.5);

        this.boss = null;
        this.enemies = [];
        this.bullets = [];
        this.orbs = [];

        this.spawnT = 0;
        this.pendingLevelUps = 0;

        this._bossDecision = null;
        this._bossDecisionPromise = null;

        // ✅ reset do throttle de IA
        this._nextAiThinkAt = 0;

        if (this.levelPanel) hideLevelUp(this.levelPanel);
        this._hideEndOverlay();
    }

    nextStage() {
        this.stage = (this.stage || 1) + 1;
        this.diff = this._computeDifficulty();

        this.time = 0;
        this.running = true;
        this.pausedForLevelUp = false;

        this.boss = null;
        this.enemies = [];
        this.bullets = [];
        this.orbs = [];
        this.spawnT = 0;

        const healFrac = CFG.stages?.healOnNext ?? 0.35;
        const p = this.player;
        if (p) {
            p.x = this.w * 0.5;
            p.y = this.h * 0.5;
            if (Number.isFinite(p.maxHp) && Number.isFinite(p.hp)) {
                p.hp = Math.min(p.maxHp, p.hp + p.maxHp * healFrac);
            }
        }

        this._bossDecision = null;
        this._bossDecisionPromise = null;

        // ✅ reset do throttle de IA
        this._nextAiThinkAt = 0;

        if (this.levelPanel) hideLevelUp(this.levelPanel);
        this._hideEndOverlay();
    }

    start() {
        let last = performance.now();

        const frame = async (now) => {
            const dt = Math.min(0.033, (now - last) / 1000);
            last = now;

            if (this.running) await this.update(dt);

            if (this.renderer) this.renderer.draw(this._renderState());
            else this.draw2d();

            requestAnimationFrame(frame);
        };

        requestAnimationFrame(frame);
    }

    _renderState() {
        return {
            arena: { w: this.w, h: this.h },
            time: this.time,
            stage: this.stage,
            player: this.player,
            enemies: this.enemies,
            boss: this.boss,
            bullets: this.bullets,
            orbs: this.orbs,
        };
    }

    _hudState() {
        const p = this.player;
        const b = this.boss;

        const bossIn = b ? null : Math.max(0, (this.diff?.bossSpawnAt ?? CFG.boss.spawnAt) - this.time);

        return {
            name: "Player",
            level: p.level ?? 1,
            xp: p.xp ?? 0,
            xpNext: p.xpNext ?? 10,
            hp: p.hp ?? 100,
            maxHp: p.maxHp ?? 100,
            dmg: p.dmg ?? 10,
            fr: p.fireRate ?? 2,
            spd: (CFG.player?.speed ?? 3),
            time: this.time,

            stage: this.stage ?? 1,

            enemies: this.enemies.length + (b ? 1 : 0),

            bossAi: !!this.ai?.enabled,
            bossIn,

            bossHp: b ? b.hp : null,
            bossMaxHp: b ? b.maxHp : null,
        };
    }

    queueLevelUp() {
        this.pendingLevelUps++;
    }

    showLevelUpIfNeeded() {
        if (this.pendingLevelUps <= 0) return;

        if (!this.levelPanel || !this.choicesEl) {
            const opt = this._rollUpgrades()[0];
            opt?.apply?.(this.player);
            this.pendingLevelUps--;
            return;
        }

        this.pausedForLevelUp = true;
        const opts = this._rollUpgrades();

        showLevelUp(this.levelPanel, this.choicesEl, opts, (pick) => {
            pick.apply(this.player);
            this.pendingLevelUps--;

            if (this.pendingLevelUps <= 0) {
                this.pausedForLevelUp = false;
                hideLevelUp(this.levelPanel);
            } else {
                hideLevelUp(this.levelPanel);
                this.pausedForLevelUp = false;
            }
        });
    }

    _rollUpgrades() {
        const all = [
            { title: "+ Dano", desc: "Aumenta dano do tiro em +4", apply: (p) => (p.dmg += 4) },
            { title: "+ Fire Rate", desc: "Atira mais rápido (+1.2 tiros/s)", apply: (p) => (p.fireRate += 1.2) },
            {
                title: "+ Velocidade",
                desc: "Movimento +12%",
                apply: () => { CFG.player.speed *= 1.12; }
            },
            {
                title: "+ HP Máx",
                desc: "HP máximo +20 (cura +20)",
                apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); }
            },
            { title: "+ Velocidade do tiro", desc: "Projéteis +15% velocidade", apply: (p) => (p.bulletSpeedMul *= 1.15) }
        ];

        const pick = [];
        const pool = [...all];
        while (pick.length < 3 && pool.length) {
            const i = Math.floor(Math.random() * pool.length);
            pick.push(pool.splice(i, 1)[0]);
        }
        return pick;
    }

    damagePlayer(amount) {
        if (!Number.isFinite(amount)) return;
        this.player.hp = Math.max(0, this.player.hp - amount);

        if (this.player.hp <= 0) {
            this.running = false;
            this._showEndOverlay("VOCÊ MORREU", { canNext: false });
        }
    }

    spawnEnemy(x, y, weaker = false) {
        const maxAlive = CFG.enemies.maxAlive + (this.diff?.maxAliveAdd ?? 0);
        if (this.enemies.length >= maxAlive) return;

        const e = new Enemy(x, y);

        e.hp *= (this.diff?.enemyHpMul ?? 1);
        e.speed *= (this.diff?.enemySpeedMul ?? 1);

        if (weaker) {
            e.hp *= 0.8;
            e.speed *= 0.95;
        }

        this.enemies.push(e);
    }

    spawnBullet(x, y, tx, ty, dmg, speedMul) {
        this.bullets.push(new Bullet(x, y, tx, ty, dmg, speedMul));
    }

    spawnOrb(x, y) {
        this.orbs.push(new Orb(x, y));
    }

    // ========= Boss projectiles =========
    _bossProjectileDamage() {
        const base = CFG.boss.projectileDmg ?? 12;
        return base * (this.diff?.bossDmgMul ?? 1);
    }

    spawnBossRing(x, y, count) {
        const dmg = this._bossProjectileDamage() * 0.75;

        for (let i = 0; i < count; i++) {
            const a = (Math.PI * 2 * i) / count;
            const dir = fromAngle(a);

            const b = new Bullet(x, y, x + dir.x, y + dir.y, dmg, 0.55);
            b.r = 5;
            b.vx *= 0.55;
            b.vy *= 0.55;
            b.ttl = 1.8;
            b.isEnemy = true;
            this.bullets.push(b);
        }
    }

    spawnBossShotgun(x, y, tx, ty, intensity = 0.5) {
        const pellets = 6 + Math.floor(intensity * 6);
        const spread = 0.45 + intensity * 0.35;
        const baseDmg = this._bossProjectileDamage() * (0.55 + intensity * 0.35);

        const ang = Math.atan2(ty - y, tx - x);

        for (let i = 0; i < pellets; i++) {
            const t = pellets <= 1 ? 0 : (i / (pellets - 1)) * 2 - 1;
            const a = ang + t * spread;

            const dir = fromAngle(a);
            const b = new Bullet(x, y, x + dir.x, y + dir.y, baseDmg, 0.75);
            b.isEnemy = true;
            b.r = 4;
            b.ttl = 1.35;
            b.vx *= 0.85;
            b.vy *= 0.85;
            this.bullets.push(b);
        }
    }

    findNearestEnemy(x, y) {
        let best = null, bestD2 = Infinity;
        const list = this.boss ? [this.boss, ...this.enemies] : this.enemies;

        for (const e of list) {
            const dx = e.x - x, dy = e.y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { bestD2 = d2; best = e; }
        }
        return best;
    }

    _maybeRequestBossDecision(nowTime) {
        // ✅ respeita toggle/off
        if (!this.ai) return;
        if (this.ai.enabled === false) return;

        // ✅ throttle (não chama todo frame)
        const every = CFG.ai?.thinkEvery ?? 0.35;
        if (nowTime < (this._nextAiThinkAt ?? 0)) return;

        // se tem promise em voo, não dispara outra
        if (this._bossDecisionPromise) return;

        this._nextAiThinkAt = nowTime + every;

        try {
            const res = this.ai?.think?.(this, nowTime);

            if (res && typeof res.then === "function") {
                this._bossDecisionPromise = res
                    .then((d) => { this._bossDecision = d; })
                    .catch(() => { })
                    .finally(() => { this._bossDecisionPromise = null; });
            } else {
                this._bossDecision = res ?? this._bossDecision;
            }
        } catch {
            // ignora
        }
    }

    async update(dt) {
        if (this.pausedForLevelUp) {
            this.hud?.update?.(this._hudState());
            this.input.endFrame();
            return;
        }

        this.time += dt;

        // Boss spawn (por Stage)
        if (!this.boss && this.time >= (this.diff?.bossSpawnAt ?? CFG.boss.spawnAt)) {
            const maxHp = (CFG.boss.maxHp ?? 900) * (this.diff?.bossHpMul ?? 1);
            const dmgMul = (this.diff?.bossDmgMul ?? 1);

            this.boss = new Boss(this.w * 0.5, CFG.arenaPadding + 80, {
                stage: this.stage,
                maxHp,
                dmgMul,
                powers: this._bossUnlockedPowers(),
            });
        }

        // Enemy spawn (por Stage) — ✅ mais estável com while
        this.spawnT += dt;

        const spawnEveryBase = CFG.enemies.spawnEvery;
        const spawnEveryMin = CFG.stages?.spawnEveryMin ?? 0.35;
        const spawnEvery = Math.max(spawnEveryMin, spawnEveryBase / (this.diff?.spawnRateMul ?? 1));

        while (this.spawnT >= spawnEvery) {
            this.spawnT -= spawnEvery;

            const extra = Math.floor((this.stage - 1) / 4);
            const n = 1 + extra;

            for (let i = 0; i < n; i++) spawnEnemyFromEdge(this);
        }

        // Update player
        this.player.update(this, dt);

        // Update enemies
        for (const e of this.enemies) e.update(this, dt);

        // Boss AI decision
        if (this.boss) {
            this._maybeRequestBossDecision(this.time);
            this.boss.update(this, dt, this._bossDecision);
        }

        // Update bullets
        for (const b of this.bullets) b.update(this, dt);

        // Update orbs
        for (const o of this.orbs) o.update(this, dt);

        // Collisions: bullets vs enemies/boss
        for (const b of this.bullets) {
            if (b.dead) continue;

            if (b.isEnemy) {
                if (circlesHit(b, this.player)) {
                    b.dead = true;
                    // ✅ usa dano do projétil (permite padrões diferentes)
                    const dmg = Number.isFinite(b.dmg) ? b.dmg : this._bossProjectileDamage();
                    this.damagePlayer(dmg);
                }
                continue;
            }

            for (const e of this.enemies) {
                if (!e.dead && circlesHit(b, e)) {
                    e.hit(b.dmg);
                    b.dead = true;

                    this.renderer?.hitFx?.(e.x, e.y);
                    this.renderer?.damageText?.(e.x, e.y - 18, b.dmg);
                    break;
                }
            }

            if (!b.dead && this.boss && !this.boss.dead && circlesHit(b, this.boss)) {
                this.boss.takeDamage(b.dmg);
                b.dead = true;

                this.renderer?.hitFx?.(this.boss.x, this.boss.y);
                this.renderer?.damageText?.(this.boss.x, this.boss.y - 22, b.dmg);
            }
        }

        // Enemies contact damage
        const enemyDmg = CFG.enemies.dmg * (this.diff?.enemyDmgMul ?? 1);
        for (const e of this.enemies) {
            if (!e.dead && circlesHit(e, this.player)) {
                this.damagePlayer(enemyDmg * dt);
            }
        }

        // Orbs pickup
        for (const o of this.orbs) {
            if (!o.dead && circlesHit(o, this.player)) {
                o.dead = true;
                this.player.giveXp(o.xp);
            }
        }

        // Drops
        for (const e of this.enemies) {
            if (e.dead) this.spawnOrb(e.x, e.y);
        }

        // Cleanup
        this.enemies = this.enemies.filter((e) => !e.dead);
        this.bullets = this.bullets.filter((b) => !b.dead);
        this.orbs = this.orbs.filter((o) => !o.dead);

        // Boss defeated
        if (this.boss && this.boss.dead) {
            this.running = false;
            this._showEndOverlay(`BOSS DERROTADO! (Stage ${this.stage})`, { canNext: true });
        }

        // Level up
        this.showLevelUpIfNeeded();

        // HUD
        this.hud?.update?.(this._hudState());
        this.input.endFrame();
    }

    draw2d() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);
    }
}
