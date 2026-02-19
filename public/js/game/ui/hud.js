const $ = (id) => document.getElementById(id);

/**
 * Atualiza o HUD usando um "state" já normalizado (pra uso futuro).
 * Você pode usar isso no main se quiser migrar depois.
 */
export function createHud() {
  const el = {
    name: $("hudName"),
    level: $("hudLevel"),
    xp: $("hudXp"),
    hpFill: $("hudHpFill"),
    dmg: $("hudDmg"),
    fr: $("hudFr"),
    spd: $("hudSpd"),
    time: $("hudTime"),
    enemies: $("hudEnemies"),
    bossAi: $("hudBossAi"),
    bossIn: $("hudBossIn"),
  };

  function setText(node, v) {
    if (node) node.textContent = String(v);
  }

  return {
    update(state) {
      if (!state) return;

      setText(el.name, state.name ?? "Player");
      setText(el.level, state.level ?? 1);
      setText(el.xp, `${Math.floor(state.xp ?? 0)}/${Math.floor(state.xpNext ?? 10)}`);

      const hpRatio = Math.max(0, Math.min(1, (state.hp ?? 0) / (state.maxHp || 1)));
      if (el.hpFill) {
        el.hpFill.style.width = `${hpRatio * 100}%`;
        el.hpFill.style.filter = hpRatio < 0.3 ? "hue-rotate(-60deg) saturate(1.6)" : "none";
      }

      setText(el.dmg, state.dmg ?? 0);
      setText(el.fr, (Number(state.fr) || 0).toFixed(1));
      setText(el.spd, (Number(state.spd) || 0).toFixed(1));

      setText(el.time, `${(Number(state.time) || 0).toFixed(1)}s`);
      setText(el.enemies, state.enemies ?? 0);

      setText(el.bossAi, state.bossAi ? "ON" : "OFF");
      setText(el.bossIn, state.bossIn == null ? "--" : `${Math.ceil(state.bossIn)}s`);
    },
  };
}

/**
 * ✅ Função que o seu Game.js espera:
 * import { renderHUD } from "./ui/hud.js";
 *
 * Ela lê diretamente do objeto game (player/enemies/time etc.)
 * e atualiza o HUD baseado nos IDs do HTML.
 */
export function renderHUD(hudEl, game) {
  // hudEl não é obrigatório aqui; você pode usar se quiser esconder/mostrar.
  // Mantive pra compatibilidade.
  if (!game) return;

  const p = game.player ?? {};

  // IDs no HTML (do HUD novo)
  const hudName = $("hudName");
  const hudLevel = $("hudLevel");
  const hudXp = $("hudXp");
  const hudHpFill = $("hudHpFill");

  const hudDmg = $("hudDmg");
  const hudFr = $("hudFr");
  const hudSpd = $("hudSpd");

  const hudTime = $("hudTime");
  const hudEnemies = $("hudEnemies");
  const hudBossAi = $("hudBossAi");
  const hudBossIn = $("hudBossIn");

  // util
  const setText = (node, v) => {
    if (node) node.textContent = String(v);
  };

  // --- valores do game (compatível com seu Player atual)
  const name = p.name ?? "Player";
  const level = p.level ?? game.level ?? 1;

  const xp = p.xp ?? game.xp ?? 0;
  const xpNext = p.xpNext ?? game.xpNext ?? 10;

  const hp = p.hp ?? p.health ?? 100;
  const maxHp = p.maxHp ?? p.maxHealth ?? 100;

  const dmg = p.dmg ?? p.damage ?? game.damage ?? 10;
  const fr = p.fireRate ?? game.fireRate ?? 2.0;

  // se você usa CFG.player.speed como “global”, tenta ler do player primeiro:
  const spd = p.speed ?? (typeof CFG !== "undefined" ? (CFG?.player?.speed ?? 3.0) : 3.0);

  const time = game.time ?? game.elapsed ?? 0;
  const enemiesCount = (game.enemies ?? []).length;

  // sua IA tem toggle no BossAIClient; o boolean exato depende do seu client.
  // Aqui eu tento inferir:
  const bossAiOn = !!(game.ai?.enabled ?? game.ai?.on ?? game.ai?.active);

  // spawn do boss (se você quiser, dá pra exibir countdown real se existir cfg)
  const bossIn = game.boss
    ? null
    : (game.time != null && game.time < (game?.CFG?.boss?.spawnAt ?? 0))
      ? Math.max(0, (game?.CFG?.boss?.spawnAt ?? 0) - game.time)
      : null;

  // --- update DOM
  setText(hudName, name);
  setText(hudLevel, level);
  setText(hudXp, `${Math.floor(xp)}/${Math.floor(xpNext)}`);

  const hpRatio = Math.max(0, Math.min(1, hp / (maxHp || 1)));
  if (hudHpFill) {
    hudHpFill.style.width = `${hpRatio * 100}%`;
    hudHpFill.style.filter = hpRatio < 0.3 ? "hue-rotate(-60deg) saturate(1.6)" : "none";
  }

  setText(hudDmg, dmg);
  setText(hudFr, (Number(fr) || 0).toFixed(1));
  setText(hudSpd, (Number(spd) || 0).toFixed(1));

  setText(hudTime, `${(Number(time) || 0).toFixed(1)}s`);
  setText(hudEnemies, enemiesCount);

  setText(hudBossAi, bossAiOn ? "ON" : "OFF");
  setText(hudBossIn, bossIn == null ? "--" : `${Math.ceil(bossIn)}s`);
}
