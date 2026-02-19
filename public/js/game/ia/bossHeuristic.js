import { angleTo, clamp } from "../math.js";

export function heuristicBossDecision(state) {
    const dx = state.player.x - state.boss.x;
    const dy = state.player.y - state.boss.y;
    const dist = Math.hypot(dx, dy);
    const ang = angleTo(state.boss.x, state.boss.y, state.player.x, state.player.y);

    const hpPct = state.boss.hp / state.boss.maxHp;
    const phase = state.boss.phase;

    // simples, mas “jogável”
    if (hpPct < 0.28 && state.boss.cdShield <= 0) {
        return { action: "SHIELD", targetAngle: ang, intensity: 1, notes: "heuristic_shield" };
    }

    if (dist < 140 && state.boss.cdDash <= 0) {
        return { action: "DASH", targetAngle: ang, intensity: clamp(0.7 + phase * 0.1, 0, 1), notes: "heuristic_dash" };
    }

    if (dist >= 140 && dist < 260 && state.boss.cdRing <= 0) {
        return { action: "SHOOT_RING", targetAngle: ang, intensity: clamp(0.55 + phase * 0.15, 0, 1), notes: "heuristic_ring" };
    }

    if (state.enemiesAlive < 16 && state.boss.cdSummon <= 0) {
        return { action: "SUMMON", targetAngle: ang, intensity: clamp(0.5 + phase * 0.2, 0, 1), notes: "heuristic_summon" };
    }

    return { action: "CHASE", targetAngle: ang, intensity: 0.6, notes: "heuristic_chase" };
}
