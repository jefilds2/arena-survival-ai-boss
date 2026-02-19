// public/js/game/systems/collision.js
function getR(o) {
    const r = o?.r ?? o?.radius ?? o?.hitR ?? o?.hitRadius;
    return Number.isFinite(r) ? r : 0;
}

export function circlesHit(a, b) {
    if (!a || !b) return false;

    const ax = Number(a.x ?? 0);
    const ay = Number(a.y ?? 0);
    const bx = Number(b.x ?? 0);
    const by = Number(b.y ?? 0);

    const ar = getR(a);
    const br = getR(b);

    const dx = ax - bx;
    const dy = ay - by;
    const rr = ar + br;

    return (dx * dx + dy * dy) <= (rr * rr);
}
