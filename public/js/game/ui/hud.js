// public/js/game/ui/hud.js
export default function initHUD() {
  const root = document.getElementById("hud");
  if (!root) return null;

  root.innerHTML = "";
  root.style.position = "absolute";
  root.style.inset = "0";
  root.style.pointerEvents = "none";
  root.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
  root.style.color = "rgba(255,255,255,.92)";

  const left = document.createElement("div");
  left.style.position = "absolute";
  left.style.left = "14px";
  left.style.top = "14px";
  left.style.width = "310px";
  left.style.padding = "12px 12px";
  left.style.borderRadius = "14px";
  left.style.background = "rgba(0,0,0,.55)";
  left.style.border = "1px solid rgba(255,255,255,.10)";
  left.style.backdropFilter = "blur(6px)";

  const hpWrap = document.createElement("div");
  hpWrap.style.height = "10px";
  hpWrap.style.borderRadius = "999px";
  hpWrap.style.background = "rgba(255,255,255,.10)";
  hpWrap.style.overflow = "hidden";
  hpWrap.style.marginTop = "8px";

  const hpFill = document.createElement("div");
  hpFill.style.height = "100%";
  hpFill.style.width = "100%";
  hpFill.style.background = "rgba(120,255,120,.85)";
  hpFill.style.borderRadius = "999px";
  hpWrap.appendChild(hpFill);

  const title = document.createElement("div");
  title.style.fontWeight = "800";
  title.style.fontSize = "14px";

  const sub = document.createElement("div");
  sub.style.marginTop = "6px";
  sub.style.fontSize = "12px";
  sub.style.opacity = ".9";

  left.appendChild(title);
  left.appendChild(hpWrap);
  left.appendChild(sub);

  const right = document.createElement("div");
  right.style.position = "absolute";
  right.style.right = "14px";
  right.style.top = "14px";
  right.style.width = "280px";
  right.style.padding = "12px 12px";
  right.style.borderRadius = "14px";
  right.style.background = "rgba(0,0,0,.55)";
  right.style.border = "1px solid rgba(255,255,255,.10)";
  right.style.backdropFilter = "blur(6px)";
  right.style.textAlign = "right";

  const r1 = document.createElement("div");
  r1.style.fontWeight = "800";
  r1.style.fontSize = "14px";

  const r2 = document.createElement("div");
  r2.style.marginTop = "6px";
  r2.style.fontSize = "12px";
  r2.style.opacity = ".9";

  right.appendChild(r1);
  right.appendChild(r2);

  // Boss HP bar (top-center)
  const bossBar = document.createElement("div");
  bossBar.style.position = "absolute";
  bossBar.style.left = "50%";
  bossBar.style.top = "14px";
  bossBar.style.transform = "translateX(-50%)";
  bossBar.style.width = "min(520px, 70vw)";
  bossBar.style.padding = "10px 12px";
  bossBar.style.borderRadius = "14px";
  bossBar.style.background = "rgba(0,0,0,.55)";
  bossBar.style.border = "1px solid rgba(255,255,255,.10)";
  bossBar.style.backdropFilter = "blur(6px)";
  bossBar.style.display = "none";

  const bossTitle = document.createElement("div");
  bossTitle.style.fontWeight = "900";
  bossTitle.style.fontSize = "12px";
  bossTitle.style.letterSpacing = ".4px";
  bossTitle.style.opacity = ".95";
  bossTitle.textContent = "BOSS";

  const bossHpWrap = document.createElement("div");
  bossHpWrap.style.height = "10px";
  bossHpWrap.style.borderRadius = "999px";
  bossHpWrap.style.background = "rgba(255,255,255,.10)";
  bossHpWrap.style.overflow = "hidden";
  bossHpWrap.style.marginTop = "8px";

  const bossHpFill = document.createElement("div");
  bossHpFill.style.height = "100%";
  bossHpFill.style.width = "100%";
  bossHpFill.style.background = "rgba(255,80,80,.85)";
  bossHpFill.style.borderRadius = "999px";
  bossHpWrap.appendChild(bossHpFill);

  const bossMeta = document.createElement("div");
  bossMeta.style.marginTop = "6px";
  bossMeta.style.fontSize = "11px";
  bossMeta.style.opacity = ".82";
  bossMeta.style.display = "flex";
  bossMeta.style.justifyContent = "space-between";

  const bossLeft = document.createElement("span");
  const bossRight = document.createElement("span");
  bossMeta.appendChild(bossLeft);
  bossMeta.appendChild(bossRight);

  bossBar.appendChild(bossTitle);
  bossBar.appendChild(bossHpWrap);
  bossBar.appendChild(bossMeta);

  root.appendChild(left);
  root.appendChild(right);
  root.appendChild(bossBar);

  function update(state) {
    if (!state) return;

    const hpPct = Math.max(0, Math.min(1, (state.hp || 0) / Math.max(1, state.maxHp || 1)));
    hpFill.style.width = `${(hpPct * 100).toFixed(1)}%`;

    title.textContent = `${state.name} • Stage ${state.stage} • Lv ${state.level} • XP ${state.xp}/${state.xpNext}`;
    sub.textContent =
      `DMG ${state.dmg}  FR ${(state.fr ?? 0).toFixed(1)}/s  SPD ${(state.spd ?? 0).toFixed(0)}  HP ${Math.round(state.hp)}/${Math.round(state.maxHp)}`;

    const t = (state.stageTime ?? state.time ?? 0);
    r1.textContent = `Tempo ${(t).toFixed(1)}s • Enemies ${state.enemies ?? 0}`;
    if (state.bossIn != null) {
      r2.textContent = `Boss IA: ${state.bossAi ? "ON" : "OFF"}   Boss em ${Math.ceil(state.bossIn)}s`;
    } else {
      r2.textContent = `Boss IA: ${state.bossAi ? "ON" : "OFF"}   Boss ativo`;
    }

    if (state.bossHp != null && state.bossMaxHp != null) {
      bossBar.style.display = "block";
      const bp = Math.max(0, Math.min(1, state.bossHp / Math.max(1, state.bossMaxHp)));
      bossHpFill.style.width = `${(bp * 100).toFixed(1)}%`;
      bossLeft.textContent = `HP ${Math.round(state.bossHp)}/${Math.round(state.bossMaxHp)}`;
      bossRight.textContent = `Stage ${state.stage}`;
    } else {
      bossBar.style.display = "none";
    }
  }

  return { update };
}
