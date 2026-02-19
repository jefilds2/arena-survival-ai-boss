// public/js/game/ui/levelup.js
// Robusto: funciona mesmo se o CSS estiver incompleto, e não quebra se faltar elemento.

export function showLevelUp(panel, choicesEl, options, onPick) {
    if (!panel || !choicesEl) return;

    // força visibilidade (independe do CSS)
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
    panel.style.display = "grid";
    panel.style.placeItems = "center";
    panel.style.position = "absolute";
    panel.style.inset = "0";
    panel.style.zIndex = "50";
    panel.style.pointerEvents = "auto";

    panel.classList.add("show");
    panel.classList.remove("hide");

    // limpa escolhas anteriores
    choicesEl.innerHTML = "";

    for (const opt of options) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice";
        btn.innerHTML = `
      <div class="t">${opt.title}</div>
      <div class="d">${opt.desc}</div>
    `;

        btn.addEventListener("click", () => {
            // NÃO fecha aqui; quem fecha é o Game.js (no callback onPick)
            onPick?.(opt);
        });

        choicesEl.appendChild(btn);
    }
}

export function hideLevelUp(panel) {
    if (!panel) return;

    panel.classList.remove("show");
    panel.classList.add("hide");

    panel.setAttribute("aria-hidden", "true");
    panel.style.pointerEvents = "none";
    panel.style.display = "none";
    panel.hidden = true;
}
