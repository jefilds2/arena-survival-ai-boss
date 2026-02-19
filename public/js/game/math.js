export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const len = (x, y) => Math.hypot(x, y);

export function norm(x, y) {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
}

export function angleTo(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
}

export function fromAngle(a) {
    return { x: Math.cos(a), y: Math.sin(a) };
}

export function rand(a, b) {
    return a + Math.random() * (b - a);
}
