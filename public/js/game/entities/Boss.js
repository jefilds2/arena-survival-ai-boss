import { CFG } from "../constants.js";
import { clamp, fromAngle, norm, angleTo } from "../math.js";
import { circlesHit } from "../systems/collision.js";

export class Boss {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.r = CFG.boss.radius;

        this.hp = CFG.boss.maxHp;
        this.maxHp = CFG.boss.maxHp;

        this.vx = 0; this.vy = 0;
        this.dead = false;

        this.cdDash = 0;
        this.cdRing = 0;
        this.cdSummon = 0;
        this.cdShield = 0;

        this.shieldTime = 0;
        this.lastAction = "IDLE";

        // telegraph visual do próximo ataque forte
        this.telegraph = 0;
        this.telegraphAngle = 0;
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

    update(game, dt, bossDecision) {
        this.cdDash = Math.max(0, this.cdDash - dt);
        this.cdRing = Math.max(0, this.cdRing - dt);
        this.cdSummon = Math.max(0, this.cdSummon - dt);
        this.cdShield = Math.max(0, this.cdShield - dt);
        this.shieldTime = Math.max(0, this.shieldTime - dt);

        this.telegraph = Math.max(0, this.telegraph - dt);

        // Executa decisão “atômica” quando chega
        if (bossDecision && bossDecision.action) {
            this.lastAction = bossDecision.action;

            const angToPlayer = angleTo(this.x, this.y, game.player.x, game.player.y);
            const a = Number.isFinite(bossDecision.targetAngle) ? bossDecision.targetAngle : angToPlayer;
            const intensity = clamp(bossDecision.intensity ?? 0.5, 0, 1);

            if (bossDecision.action === "DASH" && this.cdDash <= 0) {
                // telegraph antes do dash
                this.telegraph = 0.22;
                this.telegraphAngle = a;
                this._queued = { type: "DASH", a, intensity };
                this.cdDash = CFG.boss.dashCd;
            }

            if (bossDecision.action === "SHOOT_RING" && this.cdRing <= 0) {
                this.telegraph = 0.18;
                this.telegraphAngle = a;
                this._queued = { type: "RING", a, intensity };
                this.cdRing = CFG.boss.ringCd;
            }

            if (bossDecision.action === "SUMMON" && this.cdSummon <= 0) {
                this._queued = { type: "SUMMON", a, intensity };
                this.cdSummon = CFG.boss.summonCd;
            }

            if (bossDecision.action === "SHIELD" && this.cdShield <= 0) {
                this.shieldTime = 1.1 + intensity * 0.9;
                this.cdShield = CFG.boss.shieldCd;
            }
        }

        // Quando telegraph acabar, dispara queued
        if (this.telegraph <= 0 && this._queued) {
            const q = this._queued;
            this._queued = null;

            if (q.type === "DASH") {
                const dir = fromAngle(q.a);
                const dashSpeed = 520 + q.intensity * 250;
                this.vx = dir.x * dashSpeed;
                this.vy = dir.y * dashSpeed;
            }

            if (q.type === "RING") {
                game.spawnBossRing(this.x, this.y, 10 + Math.floor(q.intensity * 10));
            }

            if (q.type === "SUMMON") {
                const amount = 3 + Math.floor(q.intensity * 4) + (this.phase() - 1);
                for (let i = 0; i < amount; i++) {
                    game.spawnEnemy(this.x + (Math.random() * 80 - 40), this.y + (Math.random() * 80 - 40), true);
                }
            }
        }

        // Movimento base: se não estiver “voando” do dash, persegue
        const speed = CFG.boss.speed + (this.phase() - 1) * 20;
        const chasing = (this.lastAction === "CHASE" || this.lastAction === "IDLE");
        if (chasing) {
            const dx = game.player.x - this.x;
            const dy = game.player.y - this.y;
            const n = norm(dx, dy);
            this.vx = n.x * speed;
            this.vy = n.y * speed;
        } else {
            // fricção pós dash
            this.vx *= Math.pow(0.02, dt);
            this.vy *= Math.pow(0.02, dt);
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.x = clamp(this.x, CFG.arenaPadding, game.w - CFG.arenaPadding);
        this.y = clamp(this.y, CFG.arenaPadding, game.h - CFG.arenaPadding);

        // Dano de contato
        if (circlesHit(this, game.player)) {
            game.damagePlayer(CFG.boss.contactDmg * dt);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // shadow-ish
        ctx.beginPath();
        ctx.arc(3, 3, this.r + 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,.25)";
        ctx.fill();

        // body
        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,210,70,.92)";
        ctx.fill();

        // shield glow
        if (this.shieldTime > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.r + 8, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(130,200,255,.55)";
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // telegraph
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
