// public/js/game/entities/Boss.js
import { CFG } from "../constants.js";
import { clamp, fromAngle, norm, angleTo } from "../math.js";
import { circlesHit } from "../systems/collision.js";
import { Bullet } from "./Bullet.js";

export class Boss {
    constructor(x, y, opts = {}) {
        this.x = x;
        this.y = y;

        const baseR = CFG.boss.r ?? CFG.boss.radius ?? 34;
        this.r = baseR;
        this.radius = baseR;

        // ✅ hitbox maior só para contato (não afeta bala do player no boss)
        this.contactRadiusMul = clamp(opts.contactRadiusMul ?? CFG.boss.contactRadiusMul ?? 1.35, 1.0, 2.2);

        this.stage = opts.stage ?? 1;

        this.maxHp = opts.maxHp ?? CFG.boss.maxHp;
        this.hp = this.maxHp;

        this.speedMul = opts.speedMul ?? 1;
        this.dmgMul = opts.dmgMul ?? 1;

        // powers do stage
        const powers = opts.powers ?? [];
        this.powers = new Set((powers || []).map((p) => String(p).toUpperCase()));

        // ✅ mínimos garantidos
        this.powers.add("DASH");
        this.powers.add("SHOOT_RING");

        // ✅ Stage 1: DASH + SHOOT_RING + TELEPORT
        if ((this.stage ?? 1) <= 1) {
            this.powers.add("TELEPORT");
        }

        // ✅ fallback de unlock progressivo (caso CFG não esteja liberando tudo ainda)
        // (não remove nada que já veio de opts.powers)
        if ((this.stage ?? 1) >= 2) {
            this.powers.add("SHOTGUN");
            this.powers.add("GROUND_BLAST");
        }
        if ((this.stage ?? 1) >= 3) {
            this.powers.add("LASER");
        }
        if ((this.stage ?? 1) >= 4) {
            this.powers.add("SUMMON");
        }
        if ((this.stage ?? 1) >= 5) {
            this.powers.add("SHIELD");
        }

        this.vx = 0;
        this.vy = 0;
        this.dead = false;

        // cooldowns
        this.cdDash = 0;
        this.cdRing = 0;
        this.cdSummon = 0;
        this.cdShield = 0;
        this.cdShotgun = 0;
        this.cdTeleport = 0;
        this.cdLaser = 0;
        this.cdBlast = 0;

        // states
        this.shieldTime = 0;

        // último comportamento (pra anti-spam)
        this.lastAction = "IDLE";
        this._lastSkill = null;

        // telegraph (aviso)
        this.telegraph = 0;
        this.telegraphAngle = 0;
        this.telegraphX = null; // usado por GROUND_BLAST
        this.telegraphY = null;
        this.telegraphType = null;

        this._queued = null;

        // laser stream state
        this.laserTime = 0;
        this.laserAngle = 0;
        this._laserTick = 0;

        // preview / previsão do movimento do player
        this._pLast = null;
        this._pVel = { x: 0, y: 0 };
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

    _isKnownAction(a) {
        return [
            "IDLE", "CHASE",
            "DASH", "SHOOT_RING",
            "SUMMON", "SHIELD",
            "SHOTGUN", "TELEPORT",
            "LASER", "GROUND_BLAST",
        ].includes(String(a).toUpperCase());
    }

    _predictPlayer(game, dt) {
        const p = game.player;
        if (!p) return { tx: this.x, ty: this.y, a: 0, dist: 0, spd: 0 };

        if (!this._pLast) {
            this._pLast = { x: p.x, y: p.y };
            return {
                tx: p.x,
                ty: p.y,
                a: angleTo(this.x, this.y, p.x, p.y),
                dist: Math.hypot(p.x - this.x, p.y - this.y),
                spd: 0,
            };
        }

        const safeDt = Math.max(1e-4, dt);
        const vx = (p.x - this._pLast.x) / safeDt;
        const vy = (p.y - this._pLast.y) / safeDt;

        // suaviza (evita jitter)
        this._pVel.x = this._pVel.x * 0.70 + vx * 0.30;
        this._pVel.y = this._pVel.y * 0.70 + vy * 0.30;

        this._pLast.x = p.x;
        this._pLast.y = p.y;

        const dist = Math.hypot(p.x - this.x, p.y - this.y);
        const spd = Math.hypot(this._pVel.x, this._pVel.y);

        // horizonte de previsão (quanto mais longe, mais “lead”)
        const leadT = clamp(dist / 900, 0.18, 0.60);

        let tx = p.x + this._pVel.x * leadT;
        let ty = p.y + this._pVel.y * leadT;

        // clamp na arena
        tx = clamp(tx, CFG.arenaPadding, game.w - CFG.arenaPadding);
        ty = clamp(ty, CFG.arenaPadding, game.h - CFG.arenaPadding);

        return {
            tx,
            ty,
            a: angleTo(this.x, this.y, tx, ty),
            dist,
            spd,
        };
    }

    _weightedPick(items) {
        let sum = 0;
        for (const it of items) sum += Math.max(0, it.w || 0);
        if (sum <= 0) return null;
        let r = Math.random() * sum;
        for (const it of items) {
            r -= Math.max(0, it.w || 0);
            if (r <= 0) return it;
        }
        return items[items.length - 1] || null;
    }

    _autoDecision(game, aim) {
        const s = this.stage || 1;
        const ph = this.phase();
        const hpRatio = this.maxHp > 0 ? this.hp / this.maxHp : 1;

        const intensity = clamp(0.55 + (s - 1) * 0.07 + (ph - 1) * 0.12, 0.45, 1.0);

        // chance de skill cresce com stage/fase
        const chance = clamp(0.38 + (s - 1) * 0.05 + (ph - 1) * 0.10, 0.0, 0.78);
        if (Math.random() > chance) return { action: "CHASE", intensity };

        const picks = [];

        const repeatPenalty = (action) => {
            const a = String(action).toUpperCase();
            let mul = 1.0;
            if (a === this._lastSkill) mul *= 0.18;     // anti-spam forte
            if (a === this.lastAction) mul *= 0.55;     // anti-repetição suave
            return mul;
        };

        // Shield (defensivo)
        if (hpRatio < 0.62 && this._has("SHIELD") && this.cdShield <= 0) {
            picks.push({ action: "SHIELD", w: 1.25 * repeatPenalty("SHIELD") });
        }

        // Ground blast (pune movimento)
        if (this._has("GROUND_BLAST") && this.cdBlast <= 0) {
            const mv = clamp((aim.spd - 70) / 260, 0, 1);
            const w = (0.85 + mv * 0.9 + (s - 1) * 0.08) * repeatPenalty("GROUND_BLAST");
            picks.push({ action: "GROUND_BLAST", w, targetX: aim.tx, targetY: aim.ty });
        }

        // Laser (pressão em linha reta)
        if (this._has("LASER") && this.cdLaser <= 0) {
            const okDist = (aim.dist > 200 && aim.dist < 860) ? 1 : 0.35;
            const w = (0.95 * okDist + (ph - 1) * 0.15) * repeatPenalty("LASER");
            picks.push({ action: "LASER", w, targetAngle: aim.a });
        }

        // Shotgun (curta/média distância)
        if (this._has("SHOTGUN") && this.cdShotgun <= 0 && aim.dist < 420) {
            const w = (1.05 + (s - 1) * 0.06) * repeatPenalty("SHOTGUN");
            picks.push({ action: "SHOTGUN", w, targetX: aim.tx, targetY: aim.ty });
        }

        // Ring (zona média — mas com peso menor no stage 1 pra não “travar”)
        if (this._has("SHOOT_RING") && this.cdRing <= 0 && aim.dist > 220 && aim.dist < 760) {
            const base = (s <= 1) ? 0.55 : 0.95;
            const w = (base + (ph - 1) * 0.12) * repeatPenalty("SHOOT_RING");
            picks.push({ action: "SHOOT_RING", w });
        }

        // Dash (agressivo)
        if (this._has("DASH") && this.cdDash <= 0 && aim.dist > 160) {
            const mv = clamp((aim.spd - 40) / 240, 0, 1);
            const base = (s <= 1) ? 1.25 : 1.05;
            const w = (base + mv * 0.55) * repeatPenalty("DASH");
            picks.push({ action: "DASH", w, targetAngle: aim.a });
        }

        // Teleport (reposição)
        if (this._has("TELEPORT") && this.cdTeleport <= 0) {
            const far = clamp((aim.dist - 240) / 520, 0, 1);
            const close = (aim.dist < 140) ? 1 : 0;
            const base = (s <= 1) ? 1.15 : 0.85;
            const w = (base + far * 0.55 + close * 0.65) * repeatPenalty("TELEPORT");
            picks.push({ action: "TELEPORT", w, targetX: aim.tx, targetY: aim.ty });
        }

        // Summon (controle de arena)
        if (this._has("SUMMON") && this.cdSummon <= 0 && game.enemies.length < (10 + (s - 1) * 2)) {
            const w = (0.70 + (s - 1) * 0.05) * repeatPenalty("SUMMON");
            picks.push({ action: "SUMMON", w });
        }

        // fallback
        picks.push({ action: "CHASE", w: 0.65 });

        const pick = this._weightedPick(picks);
        if (!pick) return { action: "CHASE", intensity };

        return {
            action: pick.action,
            targetX: pick.targetX,
            targetY: pick.targetY,
            targetAngle: pick.targetAngle,
            intensity,
        };
    }

    update(game, dt, bossDecision) {
        this.cdDash = Math.max(0, this.cdDash - dt);
        this.cdRing = Math.max(0, this.cdRing - dt);
        this.cdSummon = Math.max(0, this.cdSummon - dt);
        this.cdShield = Math.max(0, this.cdShield - dt);
        this.cdShotgun = Math.max(0, this.cdShotgun - dt);
        this.cdTeleport = Math.max(0, this.cdTeleport - dt);
        this.cdLaser = Math.max(0, this.cdLaser - dt);
        this.cdBlast = Math.max(0, this.cdBlast - dt);

        this.shieldTime = Math.max(0, this.shieldTime - dt);
        this.telegraph = Math.max(0, this.telegraph - dt);

        const aim = this._predictPlayer(game, dt);

        // normaliza decisão da IA
        let dec = (bossDecision && bossDecision.action) ? { ...bossDecision } : null;
        if (dec) {
            dec.action = String(dec.action).toUpperCase();
            if (!this._isKnownAction(dec.action)) dec = null;
        }

        // se IA vier morna, o auto assume
        if (!dec || dec.action === "CHASE" || dec.action === "IDLE") {
            dec = this._autoDecision(game, aim);
        } else {
            // ✅ anti-spam mesmo quando IA manda skill repetida
            const a = dec.action;
            const isSkill = a !== "CHASE" && a !== "IDLE";
            if (isSkill && a === this._lastSkill && Math.random() < 0.68) {
                dec = this._autoDecision(game, aim);
            }
        }

        // alvo preferencial = targetX/Y > targetAngle > preview
        const tx = Number.isFinite(dec.targetX) ? dec.targetX : aim.tx;
        const ty = Number.isFinite(dec.targetY) ? dec.targetY : aim.ty;
        const a = Number.isFinite(dec.targetAngle) ? dec.targetAngle : angleTo(this.x, this.y, tx, ty);
        const intensity = clamp(dec.intensity ?? 0.6, 0, 1);

        this.lastAction = dec.action;

        // ===== enfileira ações (telegraph) =====
        const setTelegraph = (t, ang, type, x = null, y = null) => {
            this.telegraph = t;
            this.telegraphAngle = ang;
            this.telegraphType = type;
            this.telegraphX = x;
            this.telegraphY = y;
        };

        if (dec.action === "DASH" && this._has("DASH") && this.cdDash <= 0) {
            setTelegraph(0.24, a, "DASH");
            this._queued = { type: "DASH", a, intensity };
            this.cdDash = CFG.boss.dashCd ?? 3.2;
            this._lastSkill = "DASH";
        }

        if (dec.action === "SHOOT_RING" && this._has("SHOOT_RING") && this.cdRing <= 0) {
            setTelegraph(0.18, a, "RING");
            this._queued = { type: "RING", intensity };
            this.cdRing = CFG.boss.ringCd ?? 2.6;
            this._lastSkill = "SHOOT_RING";
        }

        if (dec.action === "SUMMON" && this._has("SUMMON") && this.cdSummon <= 0) {
            this._queued = { type: "SUMMON", intensity };
            this.cdSummon = CFG.boss.summonCd ?? 6.5;
            this._lastSkill = "SUMMON";
        }

        if (dec.action === "SHIELD" && this._has("SHIELD") && this.cdShield <= 0) {
            this.shieldTime = 1.1 + intensity * 0.9;
            this.cdShield = CFG.boss.shieldCd ?? 7.5;
            this._lastSkill = "SHIELD";
        }

        if (dec.action === "SHOTGUN" && this._has("SHOTGUN") && this.cdShotgun <= 0) {
            setTelegraph(0.16, a, "SHOTGUN");
            this._queued = { type: "SHOTGUN", tx, ty, intensity };
            this.cdShotgun = CFG.boss.shotgunCd ?? 3.8;
            this._lastSkill = "SHOTGUN";
        }

        if (dec.action === "TELEPORT" && this._has("TELEPORT") && this.cdTeleport <= 0) {
            setTelegraph(0.24, a, "TELEPORT");
            this._queued = { type: "TELEPORT", tx, ty, intensity };
            this.cdTeleport = CFG.boss.teleportCd ?? 6.2;
            this._lastSkill = "TELEPORT";
        }

        if (dec.action === "LASER" && this._has("LASER") && this.cdLaser <= 0) {
            setTelegraph(0.28, a, "LASER");
            this._queued = { type: "LASER", a, intensity };
            this.cdLaser = CFG.boss.laserCd ?? 5.2;
            this._lastSkill = "LASER";
        }

        if (dec.action === "GROUND_BLAST" && this._has("GROUND_BLAST") && this.cdBlast <= 0) {
            setTelegraph(0.44, a, "GROUND_BLAST", tx, ty);
            this._queued = { type: "GROUND_BLAST", tx, ty, intensity };
            this.cdBlast = CFG.boss.blastCd ?? 4.2;
            this._lastSkill = "GROUND_BLAST";
        }

        // ===== executa ação quando telegraph acaba =====
        if (this.telegraph <= 0 && this._queued) {
            const q = this._queued;
            this._queued = null;

            if (q.type === "DASH") {
                const dir = fromAngle(q.a);
                const dashSpeed = (590 + q.intensity * 360) * this.speedMul; // ✅ dash mais agressivo
                this.vx = dir.x * dashSpeed;
                this.vy = dir.y * dashSpeed;
            }

            if (q.type === "RING") {
                game.spawnBossRing?.(this.x, this.y, 12 + Math.floor(q.intensity * 12), q.intensity);
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
                game.spawnBossShotgun?.(this.x, this.y, q.tx, q.ty, q.intensity);
            }

            if (q.type === "TELEPORT") {
                // teleporta perto do preview, mas sem colar demais
                const radius = 200 + Math.random() * 180;
                const ang = Math.random() * Math.PI * 2;
                const px = q.tx + Math.cos(ang) * radius;
                const py = q.ty + Math.sin(ang) * radius;

                this.x = clamp(px, CFG.arenaPadding, game.w - CFG.arenaPadding);
                this.y = clamp(py, CFG.arenaPadding, game.h - CFG.arenaPadding);

                this.vx = 0;
                this.vy = 0;

                game.renderer?.hitFx?.(this.x, this.y);
            }

            if (q.type === "LASER") {
                // inicia “stream” (laser frontal)
                this.laserAngle = q.a;
                this.laserTime = 0.55 + q.intensity * 0.45;
                this._laserTick = 0;
                this.vx = 0;
                this.vy = 0;
            }

            if (q.type === "GROUND_BLAST") {
                // explosão no chão mirando o preview
                const px = clamp(q.tx, CFG.arenaPadding, game.w - CFG.arenaPadding);
                const py = clamp(q.ty, CFG.arenaPadding, game.h - CFG.arenaPadding);

                // “blast” grande (hitbox)
                const dmg = (CFG.boss.projectileDmg ?? 12) * this.dmgMul * (1.25 + q.intensity * 0.85);
                const r = 16 + q.intensity * 14;

                const b = new Bullet(px, py, px + 1, py, dmg, 0.0001);
                b.isEnemy = true;
                b.r = r;
                b.radius = r;
                b.ttl = 0.42;
                b.vx = 0;
                b.vy = 0;
                game.bullets?.push?.(b);

                // ring pequeno “pós-explosão” pra punir ficar parado
                game.spawnBossRing?.(px, py, 8 + Math.floor(q.intensity * 8), clamp(0.35 + q.intensity * 0.55, 0, 1));
            }
        }

        // ===== laser stream tick =====
        if (this.laserTime > 0) {
            this.laserTime = Math.max(0, this.laserTime - dt);
            this._laserTick -= dt;

            // spawn a cada ~0.06s
            if (this._laserTick <= 0) {
                this._laserTick = 0.06;

                const dir = fromAngle(this.laserAngle);
                const dmg = (CFG.boss.projectileDmg ?? 12) * this.dmgMul * 0.55;
                const speedMul = 1.75 + (this.phase() - 1) * 0.12;
                const r = 7;

                const b = new Bullet(this.x, this.y, this.x + dir.x, this.y + dir.y, dmg, speedMul);
                b.isEnemy = true;
                b.r = r;
                b.radius = r;
                b.ttl = 0.95;
                game.bullets?.push?.(b);
            }
        }

        // ===== movimento base =====
        const baseSpeed = (CFG.boss.speed ?? 110) * this.speedMul + (this.phase() - 1) * 25;
        const chasing = (this.lastAction === "CHASE" || this.lastAction === "IDLE") && this.telegraph <= 0 && this.laserTime <= 0;

        if (chasing) {
            const dx = game.player.x - this.x;
            const dy = game.player.y - this.y;
            const n = norm(dx, dy);
            this.vx = n.x * baseSpeed;
            this.vy = n.y * baseSpeed;
        } else {
            // fricção pós dash / durante skill
            this.vx *= Math.pow(0.02, dt);
            this.vy *= Math.pow(0.02, dt);
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.x = clamp(this.x, CFG.arenaPadding, game.w - CFG.arenaPadding);
        this.y = clamp(this.y, CFG.arenaPadding, game.h - CFG.arenaPadding);

        // ✅ dano de contato com hitbox ampliada (somente aqui!)
        const contactHitbox = { x: this.x, y: this.y, r: this.r * this.contactRadiusMul };
        if (circlesHit(contactHitbox, game.player)) {
            const base = (CFG.boss.contactDmg ?? CFG.boss.dmg ?? 18);
            const cdmg = base * this.dmgMul;
            game.damagePlayer(cdmg * dt);
        }
    }

    // Canvas2D fallback
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

        // telegraph direction
        if (this.telegraph > 0) {
            ctx.save();
            ctx.rotate(this.telegraphAngle);
            ctx.beginPath();
            ctx.moveTo(this.r + 8, 0);
            ctx.lineTo(this.r + 54, 0);
            ctx.strokeStyle = "rgba(255,60,60,.75)";
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();

            // ground blast marker (2d fallback)
            if (this.telegraphType === "GROUND_BLAST" && Number.isFinite(this.telegraphX) && Number.isFinite(this.telegraphY)) {
                ctx.save();
                ctx.resetTransform();
                ctx.beginPath();
                ctx.arc(this.telegraphX, this.telegraphY, 22, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(255,80,80,.65)";
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,0,0,.35)";
        ctx.stroke();

        ctx.restore();
    }
}
