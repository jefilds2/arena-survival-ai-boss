// public/js/game/ia/bossHeuristic.js
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const n = (x, d = 0) => (Number.isFinite(x) ? x : d);

function angleTo(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
}

function getPowerSet(state) {
    const arr = state?.boss?.powers ?? [];
    const set = new Set(arr.map((x) => String(x).toUpperCase()));
    // segurança: se não veio power list, assume pelo menos DASH + SHOOT_RING
    if (set.size === 0) {
        set.add("DASH");
        set.add("SHOOT_RING");
    }
    // stage 1 pede teleport
    const stage = n(state?.stage, 1);
    if (stage <= 1) set.add("TELEPORT");
    return set;
}

function hasPower(state, p) {
    return getPowerSet(state).has(String(p).toUpperCase());
}

function allowedByState(state, action) {
    // compat: se o BossAIClient novo mandou allowedActions, respeita
    const allowed = state?.boss?.allowedActions;
    if (Array.isArray(allowed) && allowed.length) {
        return allowed.map((x) => String(x).toUpperCase()).includes(String(action).toUpperCase());
    }
    return true;
}

function pickFirstAllowed(state, actions) {
    for (const a of actions) {
        if (allowedByState(state, a)) return a;
    }
    return "CHASE";
}

export function heuristicBossDecision(state) {
    const boss = state.boss;
    const player = state.player;

    const stage = n(state.stage, 1);

    const bx = n(boss.x), by = n(boss.y);
    const px = n(player.x), py = n(player.y);

    const dx = px - bx, dy = py - by;
    const dist = Math.hypot(dx, dy);

    const pvx = n(player.vx), pvy = n(player.vy);
    const pspd = Math.hypot(pvx, pvy);

    // preview: mira um pouco à frente do player
    const leadSec = clamp(n(player.leadSec, dist / 520), 0.18, 0.55);
    const predX = n(player.predX, px + pvx * leadSec);
    const predY = n(player.predY, py + pvy * leadSec);
    const leadAng = angleTo(bx, by, predX, predY);

    const hpPct = n(boss.hp) / Math.max(1, n(boss.maxHp, 1));
    const last = String(boss.lastAction ?? "IDLE").toUpperCase();

    // cooldowns (novos + antigos)
    const cdDash = n(boss.cdDash, 999);
    const cdRing = n(boss.cdRing, 999);
    const cdSummon = n(boss.cdSummon, 999);
    const cdShield = n(boss.cdShield, 999);
    const cdShotgun = n(boss.cdShotgun, 999);
    const cdTeleport = n(boss.cdTeleport, 999);
    const cdLaser = n(boss.cdLaser, 999);
    const cdBlast = n(boss.cdBlast, 999);

    // intensidade base cresce com stage e com movimento do player (fica mais agressivo)
    const baseIntensity = clamp(0.60 + (stage - 1) * 0.06 + clamp(pspd / 420, 0, 1) * 0.14, 0.55, 1.0);

    // -----------------------------
    // 1) Sobrevivência
    // -----------------------------
    if (hpPct <= 0.28 && hasPower(state, "SHIELD") && cdShield <= 0 && allowedByState(state, "SHIELD")) {
        return { action: "SHIELD", targetAngle: leadAng, intensity: clamp(baseIntensity + 0.18, 0.65, 1.0), notes: "shield_low_hp" };
    }

    // -----------------------------
    // 2) GROUND BLAST (mira onde você vai pisar)
    // — pune player rápido/strafe e também quando está em média distância
    // -----------------------------
    if (hasPower(state, "GROUND_BLAST") && cdBlast <= 0 && allowedByState(state, "GROUND_BLAST")) {
        const moving = pspd > 60;
        const mid = dist > 170 && dist < 720;

        // evita repetição (mas ainda pode repetir se estiver muito bom)
        const spam = (last === "GROUND_BLAST") ? 0.25 : 1.0;

        if ((moving || mid) && Math.random() < 0.78 * spam) {
            const intensity = clamp(baseIntensity + clamp(pspd / 520, 0, 1) * 0.20, 0.60, 1.0);
            return {
                action: "GROUND_BLAST",
                targetX: predX,
                targetY: predY,
                targetAngle: leadAng,
                intensity,
                notes: "blast_predict_step",
            };
        }
    }

    // -----------------------------
    // 3) LASER (pressão em linha — mira “lead”)
    // -----------------------------
    if (hasPower(state, "LASER") && cdLaser <= 0 && allowedByState(state, "LASER")) {
        const okDist = dist > 240 && dist < 900;
        const spam = (last === "LASER") ? 0.25 : 1.0;

        // laser fica forte quando o player corre em linha
        if (okDist && Math.random() < 0.62 * spam) {
            const intensity = clamp(baseIntensity + 0.10, 0.60, 1.0);
            return {
                action: "LASER",
                targetAngle: leadAng,
                targetX: predX,
                targetY: predY,
                intensity,
                notes: "laser_lead_line",
            };
        }
    }

    // -----------------------------
    // 4) TELEPORT (corta rota / pune distância)
    // -----------------------------
    if (hasPower(state, "TELEPORT") && cdTeleport <= 0 && allowedByState(state, "TELEPORT")) {
        const far = dist > 360 && pspd > 50;
        const tooClose = dist < 130;
        const afterRing = (last === "SHOOT_RING" || last === "RING");

        // stage 1: teleport um pouco mais frequente pra “sentir”
        const freq = stage <= 1 ? 0.72 : 0.55;

        if ((far || tooClose || afterRing) && Math.random() < freq) {
            const intensity = clamp(baseIntensity + (far ? 0.08 : 0.0), 0.55, 0.95);
            return {
                action: "TELEPORT",
                targetX: predX,
                targetY: predY,
                targetAngle: leadAng,
                intensity,
                notes: "teleport_cutoff",
            };
        }
    }

    // -----------------------------
    // 5) SHOTGUN (punir close/strafe)
    // -----------------------------
    if (hasPower(state, "SHOTGUN") && cdShotgun <= 0 && allowedByState(state, "SHOTGUN")) {
        if (dist < 380 && pspd > 65) {
            const intensity = clamp(0.60 + (1 - dist / 380) * 0.35 + clamp(pspd / 420, 0, 1) * 0.15, 0.60, 1.0);
            return {
                action: "SHOTGUN",
                targetX: predX,
                targetY: predY,
                targetAngle: leadAng,
                intensity,
                notes: "shotgun_lead",
            };
        }
    }

    // -----------------------------
    // 6) RING (zona)
    // -----------------------------
    if (hasPower(state, "SHOOT_RING") && cdRing <= 0 && allowedByState(state, "SHOOT_RING")) {
        // deixa ring acontecer mesmo em distância maior (pra você sentir o poder)
        if (dist < 640) {
            const intensity = clamp(0.58 + clamp(pspd / 420, 0, 1) * 0.18 + (1 - dist / 640) * 0.30 + (stage <= 1 ? 0.08 : 0), 0.58, 1.0);

            // evita ring em sequência (mas não mata 100%)
            const spam = (last === "SHOOT_RING" || last === "RING") ? 0.22 : 1.0;

            if (Math.random() < spam) {
                return {
                    action: "SHOOT_RING",
                    targetAngle: leadAng,
                    targetX: predX,
                    targetY: predY,
                    intensity,
                    notes: "ring_zone",
                };
            }
        }
    }

    // -----------------------------
    // 7) DASH (intercepta rota prevista)
    // -----------------------------
    if (hasPower(state, "DASH") && cdDash <= 0 && allowedByState(state, "DASH")) {
        const shouldDash =
            (dist < 320) ||                      // perto: agressivo
            (dist > 260 && pspd > 45) ||         // longe + movimento: intercepta
            (last === "SHOOT_RING" || last === "RING") || // alterna após ring
            (last === "TELEPORT");               // alterna pós teleport

        if (shouldDash) {
            const intensity = clamp(0.62 + (dist / 700) * 0.25 + clamp(pspd / 420, 0, 1) * 0.10, 0.60, 1.0);
            return {
                action: "DASH",
                targetAngle: leadAng,
                targetX: predX,
                targetY: predY,
                intensity,
                notes: "dash_intercept",
            };
        }
    }

    // -----------------------------
    // 8) SUMMON (controle de arena)
    // -----------------------------
    if (hasPower(state, "SUMMON") && cdSummon <= 0 && allowedByState(state, "SUMMON")) {
        const alive = n(state.enemiesAlive, 0);
        const cap = 14 + Math.floor((stage - 1) * 1.5);
        if (alive < cap && Math.random() < 0.55) {
            return { action: "SUMMON", targetAngle: leadAng, intensity: clamp(baseIntensity, 0.55, 0.85), notes: "summon_pressure" };
        }
    }

    // default: chase com mira “prevista”
    // se allowedActions existir e CHASE não estiver permitido (raro), cai para o primeiro permitido
    const a = allowedByState(state, "CHASE") ? "CHASE" : pickFirstAllowed(state, ["SHOOT_RING", "DASH", "TELEPORT", "SHOTGUN", "GROUND_BLAST", "LASER", "SUMMON", "SHIELD"]);
    return { action: a, targetAngle: leadAng, targetX: predX, targetY: predY, intensity: clamp(baseIntensity, 0.55, 0.95), notes: "chase_lead" };
}
