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

        // ✅ Se Pixi está ativo, NÃO use 2D ctx
        this.ctx = this.renderer ? null : this.canvas.getContext("2d");

        this.input = new Input();
        this.ai = new BossAIClient();

        // cache da última decisão do boss (evita travar FPS se AI for async)
        this._bossDecision = null;
        this._bossDecisionPromise = null;

        this.levelPanel = document.getElementById("levelup");
        this.choicesEl = document.getElementById("choices");

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
            // dimensões em CSS pixels (gameplay)
            this.w = this.canvas.clientWidth || 960;
            this.h = this.canvas.clientHeight || 540;

            // Só ajusta buffer do canvas se for Canvas2D
            if (!this.renderer && this.ctx) {
                const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
                this.canvas.width = Math.floor(this.w * dpr);
                this.canvas.height = Math.floor(this.h * dpr);
                this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
            // ✅ Se tem Pixi, NÃO mexe em canvas.width/height aqui.
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
          width:min(520px,92vw);
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
          <div style="opacity:.8;font-size:13px;margin-bottom:14px;">
            Pressione <b>R</b> para reiniciar
          </div>
          <button id="endBtn" style="
            padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.16);
            background:rgba(255,255,255,.08);color:rgba(255,255,255,.92);cursor:pointer;
            font-weight:700;
          ">Reiniciar (R)</button>
        </div>
      `;

            const root = document.getElementById("gameRoot") || document.body;
            if (!root.style.position) root.style.position = "relative";
            root.appendChild(el);

            el.querySelector("#endBtn")?.addEventListener("click", () => this.reset());
        }

        this.endOverlay = el;
        this.endTitleEl = el.querySelector("#endTitle");
    }

    _showEndOverlay(text) {
        if (!this.endOverlay) return;
        if (this.endTitleEl) this.endTitleEl.textContent = text || "FIM";
        this.endOverlay.style.display = "flex";
    }

    _hideEndOverlay() {
        if (!this.endOverlay) return;
        this.endOverlay.style.display = "none";
    }

    reset() {
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

        if (this.levelPanel) hideLevelUp(this.levelPanel);
        this._hideEndOverlay();
    }

    start() {
        let last = performance.now();

        const frame = async (now) => {
            const dt = Math.min(0.033, (now - last) / 1000);
            last = now;

            if (this.running) await this.update(dt);

            // ✅ render Pixi por frame
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
            player: this.player,
            enemies: this.enemies,
            boss: this.boss,
            bullets: this.bullets,
            orbs: this.orbs,
        };
    }

    _hudState() {
        const p = this.player;
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
            enemies: this.enemies.length + (this.boss ? 1 : 0),
            bossAi: !!this.ai?.enabled,
            bossIn: this.boss ? null : Math.max(0, (CFG.boss.spawnAt - this.time)),
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
            { title: "+ Velocidade", desc: "Movimento +12%", apply: () => { CFG.player.speed *= 1.12; } },
            { title: "+ HP Máx", desc: "HP máximo +20 (cura +20)", apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); } },
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
            this._showEndOverlay("VOCÊ MORREU");
        }
    }

    spawnEnemy(x, y, weaker = false) {
        if (this.enemies.length >= CFG.enemies.maxAlive) return;
        const e = new Enemy(x, y);
        if (weaker) { e.hp *= 0.8; e.speed *= 0.95; }
        this.enemies.push(e);
    }

    spawnBullet(x, y, tx, ty, dmg, speedMul) {
        this.bullets.push(new Bullet(x, y, tx, ty, dmg, speedMul));
    }

    spawnOrb(x, y) {
        this.orbs.push(new Orb(x, y));
    }

    spawnBossRing(x, y, count) {
        for (let i = 0; i < count; i++) {
            const a = (Math.PI * 2 * i) / count;
            const dir = fromAngle(a);
            const b = new Bullet(x, y, x + dir.x, y + dir.y, 8, 0.55);
            b.r = 5;
            b.vx *= 0.55;
            b.vy *= 0.55;
            b.ttl = 1.6;
            b.isEnemy = true;
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

    _maybeRequestBossDecision() {
        try {
            const res = this.ai?.think?.(this, this.time);

            if (res && typeof res.then === "function") {
                if (!this._bossDecisionPromise) {
                    this._bossDecisionPromise = res
                        .then((d) => { this._bossDecision = d; })
                        .catch(() => { })
                        .finally(() => { this._bossDecisionPromise = null; });
                }
            } else {
                this._bossDecision = res ?? this._bossDecision;
            }
        } catch { }
    }

    async update(dt) {
        // ✅ importante: acompanha resize no gameplay também
        this.w = this.canvas.clientWidth || this.w;
        this.h = this.canvas.clientHeight || this.h;

        if (this.pausedForLevelUp) {
            this.hud?.update?.(this._hudState());
            this.input.endFrame();
            return;
        }

        this.time += dt;

        if (!this.boss && this.time >= CFG.boss.spawnAt) {
            this.boss = new Boss(this.w * 0.5, CFG.arenaPadding + 80);
        }

        this.spawnT += dt;
        if (this.spawnT >= CFG.enemies.spawnEvery) {
            this.spawnT = 0;
            spawnEnemyFromEdge(this);
        }

        this.player.update(this, dt);
        for (const e of this.enemies) e.update(this, dt);

        if (this.boss) {
            this._maybeRequestBossDecision();
            this.boss.update(this, dt, this._bossDecision);
        }

        for (const b of this.bullets) b.update(this, dt);
        for (const o of this.orbs) o.update(this, dt);

        for (const b of this.bullets) {
            if (b.dead) continue;

            if (b.isEnemy) {
                if (circlesHit(b, this.player)) {
                    b.dead = true;
                    this.damagePlayer(12);
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

        for (const e of this.enemies) {
            if (!e.dead && circlesHit(e, this.player)) {
                this.damagePlayer(CFG.enemies.dmg * dt);
            }
        }

        for (const o of this.orbs) {
            if (!o.dead && circlesHit(o, this.player)) {
                o.dead = true;
                this.player.giveXp(o.xp);
            }
        }

        for (const e of this.enemies) {
            if (e.dead) this.spawnOrb(e.x, e.y);
        }

        this.enemies = this.enemies.filter((e) => !e.dead);
        this.bullets = this.bullets.filter((b) => !b.dead);
        this.orbs = this.orbs.filter((o) => !o.dead);

        if (this.boss && this.boss.dead) {
            this.running = false;
            this._showEndOverlay("BOSS DERROTADO!");
        }

        this.showLevelUpIfNeeded();
        this.hud?.update?.(this._hudState());
        this.input.endFrame();
    }

    draw2d() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);
    }
}
