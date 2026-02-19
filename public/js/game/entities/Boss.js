// public/js/game/entities/Boss.js
import { CFG } from "../constants.js";
import { clamp, fromAngle, norm, angleTo } from "../math.js";
import { circlesHit } from "../systems/collision.js";

export class Boss {
    constructor(x, y, opts = {}) {
        this.x = x;
        this.y = y;

        const baseR = CFG.boss.r ?? CFG.boss.radius ?? 34;
        this.r = baseR;

        this.stage = opts.stage ?? 1;

        this.maxHp = opts.maxHp ?? CFG.boss.maxHp;
        this.hp = this.maxHp;

        this.speedMul = opts.speedMul ?? 1;
        this.dmgMul = opts.dmgMul ?? 1;

        // poderes disponíveis (controlados por Stage)
        const powers = opts.powers ?? ["DASH", "SHOOT_RING"];
        this.powers = new Set(powers.map((p) => String(p).toUpperCase()));

        this.vx = 0;
        this.vy = 0;
        this.dead = false;

        this.cdDash = 0;
        this.cdRing = 0;
        this.cdSummon = 0;
        this.cdShield = 0;
        this.cdShotgun = 0;
        this.cdTeleport = 0;

        this.shieldTime = 0;
        this.lastAction = "IDLE";

        // telegraph (aviso)
        this.telegraph = 0;
        this.telegraphAngle = 0;
        this._queued = null;
    }

    phase() {
        const p = this.hp / this.maxHp;
        if (p < 0.33) return 3;
        if (p < 0.66) return 2;
        return 1;
    }

    takeDamage(dmg) {
        if (this.shieldTime > 0) dmg *= 0.35;
        this.hp -= dmg;
        if (this.hp <= 0) this.dead = true;
    }

    _has(power) {
        return this.powers.has(String(power).toUpperCase());
    }

    update(game, dt, bossDecision) {
        this.cdDash = Math.max(0, this.cdDash - dt);
        this.cdRing = Math.max(0, this.cdRing - dt);
        this.cdSummon = Math.max(0, this.cdSummon - dt);
        this.cdShield = Math.max(0, this.cdShield - dt);
        this.cdShotgun = Math.max(0, this.cdShotgun - dt);
        this.cdTeleport = Math.max(0, this.cdTeleport - dt);

        this.shieldTime = Math.max(0, this.shieldTime - dt);
        this.telegraph = Math.max(0, this.telegraph - dt);

        // ============ Decisão da IA (atômica e validada) ============
        if (bossDecision && bossDecision.action) {
            this.lastAction = bossDecision.action;

            const angToPlayer = angleTo(this.x, this.y, game.player.x, game.player.y);
            const a = Number.isFinite(bossDecision.targetAngle) ? bossDecision.targetAngle : angToPlayer;
            const intensity = clamp(bossDecision.intensity ?? 0.5, 0, 1);

            if (bossDecision.action === "DASH" && this._has("DASH") && this.cdDash <= 0) {
                this.telegraph = 0.22;
                this.telegraphAngle = a;
                this._queued = { type: "DASH", a, intensity };
                this.cdDash = CFG.boss.dashCd;
            }

            if (bossDecision.action === "SHOOT_RING" && this._has("SHOOT_RING") && this.cdRing <= 0) {
                this.telegraph = 0.18;
                this.telegraphAngle = a;
                this._queued = { type: "RING", a, intensity };
                this.cdRing = CFG.boss.ringCd;
            }

            if (bossDecision.action === "SUMMON" && this._has("SUMMON") && this.cdSummon <= 0) {
                this._queued = { type: "SUMMON", a, intensity };
                this.cdSummon = CFG.boss.summonCd;
            }

            if (bossDecision.action === "SHIELD" && this._has("SHIELD") && this.cdShield <= 0) {
                this.shieldTime = 1.1 + intensity * 0.9;
                this.cdShield = CFG.boss.shieldCd;
            }

            if (bossDecision.action === "SHOTGUN" && this._has("SHOTGUN") && this.cdShotgun <= 0) {
                this.telegraph = 0.16;
                this.telegraphAngle = a;
                this._queued = { type: "SHOTGUN", a, intensity };
                this.cdShotgun = CFG.boss.shotgunCd ?? 3.8;
            }

            if (bossDecision.action === "TELEPORT" && this._has("TELEPORT") && this.cdTeleport <= 0) {
                this.telegraph = 0.22;
                this.telegraphAngle = a;
                this._queued = { type: "TELEPORT", a, intensity };
                this.cdTeleport = CFG.boss.teleportCd ?? 6.2;
            }
        }

        // ============ Executa ação quando telegraph acaba ============
        if (this.telegraph <= 0 && this._queued) {
            const q = this._queued;
            this._queued = null;

            if (q.type === "DASH") {
                const dir = fromAngle(q.a);
                const dashSpeed = (520 + q.intensity * 250) * this.speedMul;
                this.vx = dir.x * dashSpeed;
                this.vy = dir.y * dashSpeed;
            }

            if (q.type === "RING") {
                game.spawnBossRing(this.x, this.y, 10 + Math.floor(q.intensity * 10));
            }

            if (q.type === "SUMMON") {
                const amount = 3 + Math.floor(q.intensity * 4) + (this.phase() - 1);
                for (let i = 0; i < amount; i++) {
                    game.spawnEnemy(
                        this.x + (Math.random() * 80 - 40),
                        this.y + (Math.random() * 80 - 40),
                        true
                    );
                }
            }

            if (q.type === "SHOTGUN") {
                game.spawnBossShotgun?.(this.x, this.y, game.player.x, game.player.y, q.intensity);
            }

            if (q.type === "TELEPORT") {
                // teleporta para uma região em volta do player (sem ficar colado)
                const radius = 220 + Math.random() * 140;
                const ang = Math.random() * Math.PI * 2;
                const tx = game.player.x + Math.cos(ang) * radius;
                const ty = game.player.y + Math.sin(ang) * radius;

                this.x = clamp(tx, CFG.arenaPadding, game.w - CFG.arenaPadding);
                this.y = clamp(ty, CFG.arenaPadding, game.h - CFG.arenaPadding);

                this.vx = 0;
                this.vy = 0;

                // FX opcional
                game.renderer?.hitFx?.(this.x, this.y);
            }
        }

        // ============ Movimento base ============
        const baseSpeed = (CFG.boss.speed ?? 110) * this.speedMul + (this.phase() - 1) * 20;
        const chasing = this.lastAction === "CHASE" || this.lastAction === "IDLE";

        if (chasing) {
            const dx = game.player.x - this.x;
            const dy = game.player.y - this.y;
            const n = norm(dx, dy);
            this.vx = n.x * baseSpeed;
            this.vy = n.y * baseSpeed;
        } else {
            // fricção pós dash
            this.vx *= Math.pow(0.02, dt);
            this.vy *= Math.pow(0.02, dt);
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.x = clamp(this.x, CFG.arenaPadding, game.w - CFG.arenaPadding);
        this.y = clamp(this.y, CFG.arenaPadding, game.h - CFG.arenaPadding);

        // ============ Dano de contato ============
        if (circlesHit(this, game.player)) {
            const cdmg = (CFG.boss.contactDmg ?? CFG.boss.dmg ?? 10) * this.dmgMul;
            game.damagePlayer(cdmg * dt);
        }
    }

    // Canvas2D fallback (no Pixi você não usa isso)
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.beginPath();
        ctx.arc(3, 3, this.r + 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,.25)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,210,70,.92)";
        ctx.fill();

        if (this.shieldTime > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.r + 8, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(130,200,255,.55)";
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        if (this.telegraph > 0) {
            ctx.rotate(this.telegraphAngle);
            ctx.beginPath();
            ctx.moveTo(this.r + 8, 0);
            ctx.lineTo(this.r + 54, 0);
            ctx.strokeStyle = "rgba(255,60,60,.75)";
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,0,0,.35)";
        ctx.stroke();

        ctx.restore();
    }
}
