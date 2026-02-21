// public/js/game/ia/bossAiClient.js
import { CFG } from "../constants.js";
import { heuristicBossDecision } from "./bossHeuristic.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const n = (x, d = 0) => (Number.isFinite(x) ? x : d);

export class BossAIClient {
    constructor() {
        // ✅ liga por padrão (IA ON). Só “fica sem IA” quando offline / sem resposta do server naquele tick.
        this.enabled = (CFG.ai?.enabled ?? CFG.ai?.enabledByDefault ?? true);

        // compat: thinkEvery (novo) vs thinkInterval (antigo)
        this.thinkEvery = n(CFG.ai?.thinkEvery, n(CFG.ai?.thinkInterval, 0.35));
        this.timeoutMs = n(CFG.ai?.timeoutMs, 850);

        this.nextThinkAt = 0;
        this.cached = null;

        // online/offline
        this.online = (typeof navigator !== "undefined") ? !!navigator.onLine : true;

        // ✅ true somente quando o server/Gemini respondeu OK (nesse tick)
        this.usingGemini = false;
        this.lastNotes = "init";

        // telemetria do player (pra prever próxima posição)
        this._pPrev = null;

        // fala do boss (throttle)
        this._nextSayAt = 0;

        if (typeof window !== "undefined") {
            window.addEventListener("online", () => (this.online = true));
            window.addEventListener("offline", () => (this.online = false));
        }
    }

    toggle() {
        // debug: ainda existe, mas começa ON
        this.enabled = !this.enabled;
    }

    _computePlayerTelemetry(player, nowSec) {
        const px = n(player?.x);
        const py = n(player?.y);

        let vx = 0, vy = 0, spd = 0;

        if (this._pPrev && Number.isFinite(this._pPrev.t)) {
            const dt = Math.max(1e-3, nowSec - this._pPrev.t);
            vx = (px - this._pPrev.x) / dt;
            vy = (py - this._pPrev.y) / dt;
            spd = Math.hypot(vx, vy);
        }

        this._pPrev = { x: px, y: py, t: nowSec };

        return { vx, vy, spd };
    }

    _allowedActions(boss) {
        const powers =
            boss?.powers instanceof Set
                ? [...boss.powers]
                : Array.isArray(boss?.powers)
                    ? boss.powers
                    : [];

        const has = (p) => powers.map(String).map((x) => x.toUpperCase()).includes(String(p).toUpperCase());

        const allowed = ["CHASE"];

        // só libera se estiver no power + cd <= 0
        if (has("DASH") && n(boss.cdDash, 999) <= 0) allowed.push("DASH");
        if (has("SHOOT_RING") && n(boss.cdRing, 999) <= 0) allowed.push("SHOOT_RING");
        if (has("SHOTGUN") && n(boss.cdShotgun, 999) <= 0) allowed.push("SHOTGUN");
        if (has("TELEPORT") && n(boss.cdTeleport, 999) <= 0) allowed.push("TELEPORT");
        if (has("LASER") && n(boss.cdLaser, 999) <= 0) allowed.push("LASER");
        if (has("GROUND_BLAST") && n(boss.cdBlast, 999) <= 0) allowed.push("GROUND_BLAST");
        if (has("SHIELD") && n(boss.cdShield, 999) <= 0) allowed.push("SHIELD");
        if (has("SUMMON") && n(boss.cdSummon, 999) <= 0) allowed.push("SUMMON");

        return { powers, allowed };
    }

    _angleTo(ax, ay, bx, by) {
        return Math.atan2(by - ay, bx - ax);
    }

    _sanitizeDecision(dec, ctx) {
        const { boss, player, predX, predY, allowedActions, stage } = ctx;

        if (!dec || typeof dec !== "object") return null;

        const out = { ...dec };

        out.action = String(out.action || "CHASE").toUpperCase();
        if (!allowedActions.includes(out.action)) out.action = "CHASE";

        // intensity
        out.intensity = clamp(n(out.intensity, 0.65 + Math.min(0.22, (stage - 1) * 0.05)), 0, 1);

        // targets defaults
        const fallbackX = n(predX, n(player?.x));
        const fallbackY = n(predY, n(player?.y));

        if (!Number.isFinite(out.targetX)) out.targetX = fallbackX;
        if (!Number.isFinite(out.targetY)) out.targetY = fallbackY;

        // clamp na arena
        out.targetX = clamp(out.targetX, CFG.arenaPadding, ctx.arenaW - CFG.arenaPadding);
        out.targetY = clamp(out.targetY, CFG.arenaPadding, ctx.arenaH - CFG.arenaPadding);

        // angle default (pra DASH/LASER)
        if (!Number.isFinite(out.targetAngle)) {
            out.targetAngle = this._angleTo(n(boss?.x), n(boss?.y), out.targetX, out.targetY);
        }

        // fala: só se for Gemini (__ai true) e respeita throttle
        if (out.__ai === true) {
            const canSay = ctx.nowSec >= (this._nextSayAt ?? 0);
            const isBigSkill = ["DASH", "TELEPORT", "LASER", "GROUND_BLAST", "SHOTGUN", "SHOOT_RING"].includes(out.action);

            if (canSay && isBigSkill) {
                const lines = {
                    DASH: ["Vou te esmagar!", "Corre agora.", "Te peguei!"],
                    TELEPORT: ["Acha que eu tô aí?", "Sumiu!", "Cheguei."],
                    LASER: ["Olha isso!", "Derrete.", "Linha de morte."],
                    GROUND_BLAST: ["Eu sei onde você vai pisar.", "Pisa aqui.", "Te antecipei."],
                    SHOTGUN: ["De perto dói mais.", "Espalha!", "Fechou o cone."],
                    SHOOT_RING: ["Roda da dor.", "Círculo fechado.", "Sem saída."],
                };

                const pool = lines[out.action] || ["..."];
                out.say = out.say && String(out.say).trim() ? String(out.say).trim() : pool[Math.floor(Math.random() * pool.length)];
                out.sayTtl = clamp(n(out.sayTtl, 2.2), 0.8, 6);

                // próximo say só depois de 2s~3.8s
                this._nextSayAt = ctx.nowSec + (2.0 + Math.random() * 1.8);
            } else {
                // não fala toda decisão
                delete out.say;
                delete out.sayTtl;
            }
        } else {
            // não é Gemini -> silêncio
            delete out.say;
            delete out.sayTtl;
        }

        return out;
    }

    _decorateHeuristic(decision, notes = "heuristic") {
        const d = decision ? { ...decision } : null;
        if (!d) return null;
        d.__ai = false;
        d.notes = d.notes ?? notes;
        delete d.say;
        delete d.sayTtl;
        return d;
    }

    async think(game, nowSec) {
        if (!this.enabled) {
            this.usingGemini = false;
            this.lastNotes = "disabled";
            return null;
        }

        if (nowSec < this.nextThinkAt && this.cached) return this.cached;
        this.nextThinkAt = nowSec + this.thinkEvery;

        const boss = game?.boss;
        const player = game?.player;
        if (!boss || !player) return null;

        const tel = this._computePlayerTelemetry(player, nowSec);

        // previsão simples: projeta um pouco à frente baseado em distância
        const dx = n(player.x) - n(boss.x);
        const dy = n(player.y) - n(boss.y);
        const dist = Math.hypot(dx, dy);

        const leadSec = clamp(dist / 520, 0.18, 0.55); // mais longe => prevê mais
        let predX = n(player.x) + tel.vx * leadSec;
        let predY = n(player.y) + tel.vy * leadSec;

        // clamp na arena
        predX = clamp(predX, CFG.arenaPadding, game.w - CFG.arenaPadding);
        predY = clamp(predY, CFG.arenaPadding, game.h - CFG.arenaPadding);

        const { powers, allowed } = this._allowedActions(boss);

        // Estado enxuto (com preview do player + cooldowns completos)
        const state = {
            t: Number(nowSec.toFixed(2)),
            stage: game.stage ?? 1,
            arena: { w: game.w, h: game.h },
            enemiesAlive: game.enemies?.length ?? 0,

            player: {
                x: Number(n(player.x).toFixed(1)),
                y: Number(n(player.y).toFixed(1)),
                hp: Number(n(player.hp).toFixed(1)),
                maxHp: n(player.maxHp, 100),
                level: player.level ?? 1,
                vx: Number(tel.vx.toFixed(1)),
                vy: Number(tel.vy.toFixed(1)),
                spd: Number(tel.spd.toFixed(1)),
                leadSec: Number(leadSec.toFixed(2)),
                predX: Number(predX.toFixed(1)),
                predY: Number(predY.toFixed(1)),
            },

            boss: {
                x: Number(n(boss.x).toFixed(1)),
                y: Number(n(boss.y).toFixed(1)),
                hp: Number(n(boss.hp).toFixed(1)),
                maxHp: n(boss.maxHp, 900),
                phase: boss.phase?.() ?? 1,
                lastAction: boss.lastAction ?? "IDLE",
                powers,
                allowedActions: allowed,

                cdDash: Number(n(boss.cdDash).toFixed(2)),
                cdRing: Number(n(boss.cdRing).toFixed(2)),
                cdSummon: Number(n(boss.cdSummon).toFixed(2)),
                cdShield: Number(n(boss.cdShield).toFixed(2)),
                cdShotgun: Number(n(boss.cdShotgun).toFixed(2)),
                cdTeleport: Number(n(boss.cdTeleport).toFixed(2)),

                // ✅ novos cooldowns
                cdLaser: Number(n(boss.cdLaser).toFixed(2)),
                cdBlast: Number(n(boss.cdBlast).toFixed(2)),

                // telegraph atual (útil pro Gemini não “mandar repetido”)
                telegraph: Number(n(boss.telegraph).toFixed(2)),
                telegraphType: boss.telegraphType ?? null,
            },

            // dicas pro modelo (server pode ignorar sem quebrar)
            hints: {
                objective: "Kill the player. Prefer actions that anticipate player movement (use predX/predY).",
                outputContract: {
                    action: allowed,
                    fields: ["action", "intensity", "targetX", "targetY", "targetAngle", "say"],
                    note: "Only choose actions in allowedActions. Provide say sometimes.",
                },
            },
        };

        // ✅ Sem internet: não tenta server. Continua via heurística (silenciosa)
        if (!this.online) {
            this.usingGemini = false;
            const h = heuristicBossDecision(state);
            this.cached = this._decorateHeuristic(h, "heuristic_offline");
            this.lastNotes = this.cached?.notes ?? "heuristic_offline";
            return this.cached;
        }

        // Chama server (Gemini) com timeout; falhou => heurística (silenciosa)
        const controller = new AbortController();
        const tm = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const resp = await fetch("/api/boss/decision", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state }),
                signal: controller.signal,
            });

            clearTimeout(tm);

            if (!resp.ok) throw new Error("ai_http_error");
            const data = await resp.json();
            if (!data?.ok || !data?.decision) throw new Error("ai_bad_payload");

            // ✅ Gemini respondeu -> marca como IA real
            this.usingGemini = true;

            const raw = { ...data.decision, __ai: true };
            const sanitized = this._sanitizeDecision(raw, {
                nowSec,
                stage: state.stage,
                arenaW: state.arena.w,
                arenaH: state.arena.h,
                boss,
                player,
                predX,
                predY,
                allowedActions: allowed,
            });

            if (!sanitized) throw new Error("ai_bad_decision");

            sanitized.notes = sanitized.notes ?? "gemini_ok";

            this.cached = sanitized;
            this.lastNotes = this.cached?.notes ?? "gemini_ok";
            return this.cached;
        } catch {
            clearTimeout(tm);

            this.usingGemini = false;

            const h = heuristicBossDecision(state);
            this.cached = this._decorateHeuristic(h, "heuristic_fallback");
            this.lastNotes = this.cached?.notes ?? "heuristic_fallback";
            return this.cached;
        }
    }
}
