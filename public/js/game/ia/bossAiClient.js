import { CFG } from "../constants.js";
import { heuristicBossDecision } from "./bossHeuristic.js";

export class BossAIClient {
    constructor() {
        this.enabled = CFG.ai.enabledByDefault;
        this.nextThinkAt = 0;
        this.cached = null;
    }

    toggle() { this.enabled = !this.enabled; }

    async think(game, nowSec) {
        if (!this.enabled) return null;

        if (nowSec < this.nextThinkAt && this.cached) return this.cached;

        this.nextThinkAt = nowSec + CFG.ai.thinkInterval;

        const boss = game.boss;
        const player = game.player;

        // Estado “enxuto”
        const state = {
            t: Number(nowSec.toFixed(2)),
            arena: { w: game.w, h: game.h },
            enemiesAlive: game.enemies.length,
            player: {
                x: Number(player.x.toFixed(1)),
                y: Number(player.y.toFixed(1)),
                hp: Number(player.hp.toFixed(1)),
                maxHp: player.maxHp,
                level: player.level
            },
            boss: {
                x: Number(boss.x.toFixed(1)),
                y: Number(boss.y.toFixed(1)),
                hp: Number(boss.hp.toFixed(1)),
                maxHp: boss.maxHp,
                phase: boss.phase(),
                lastAction: boss.lastAction,
                cdDash: Number(boss.cdDash.toFixed(2)),
                cdRing: Number(boss.cdRing.toFixed(2)),
                cdSummon: Number(boss.cdSummon.toFixed(2)),
                cdShield: Number(boss.cdShield.toFixed(2))
            }
        };

        // Chama o server (Gemini) com timeout curto; se falhar, cai na heurística.
        const controller = new AbortController();
        const tm = setTimeout(() => controller.abort(), CFG.ai.timeoutMs);

        try {
            const resp = await fetch("/api/boss/decision", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state }),
                signal: controller.signal
            });

            clearTimeout(tm);

            if (!resp.ok) throw new Error("ai_http_error");
            const data = await resp.json();

            if (!data?.ok || !data?.decision) throw new Error("ai_bad_payload");

            this.cached = data.decision;
            return this.cached;
        } catch {
            clearTimeout(tm);
            this.cached = heuristicBossDecision(state);
            return this.cached;
        }
    }
}
