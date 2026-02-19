// public/js/game/ui/endScreen.js
export function showEndScreen(modalRoot, { title, subtitle, onRestart, onNext }) {
    if (!modalRoot) return;

    modalRoot.innerHTML = `
    <div class="endOverlay">
      <div class="endCard">
        <h2>${title}</h2>
        <p>${subtitle || ""}</p>
        <div class="endBtns">
          <button id="btnRestart" class="btn">Reiniciar</button>
          <button id="btnNext" class="btn primary">Próxima dificuldade</button>
        </div>
        <div class="endHint">Atalhos: <b>R</b> reiniciar • <b>N</b> próxima dificuldade</div>
      </div>
    </div>
  `;

    modalRoot.querySelector("#btnRestart")?.addEventListener("click", () => onRestart?.());
    modalRoot.querySelector("#btnNext")?.addEventListener("click", () => onNext?.());
}

export function hideEndScreen(modalRoot) {
    if (!modalRoot) return;
    modalRoot.innerHTML = "";
}
