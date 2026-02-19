import { rand } from "../math.js";

export function spawnEnemyFromEdge(game) {
    const { w, h } = game;
    const side = Math.floor(rand(0, 4));
    const pad = 30;

    let x = 0, y = 0;
    if (side === 0) { x = rand(-pad, w + pad); y = -pad; }
    if (side === 1) { x = w + pad; y = rand(-pad, h + pad); }
    if (side === 2) { x = rand(-pad, w + pad); y = h + pad; }
    if (side === 3) { x = -pad; y = rand(-pad, h + pad); }

    game.spawnEnemy(x, y);
}
