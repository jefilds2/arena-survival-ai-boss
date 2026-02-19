import { CFG } from "../constants.js";

export class Orb {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.r = CFG.orbs.radius;
        this.xp = CFG.orbs.xp;
        this.dead = false;
    }

    update(game, dt) {
        // Atrai levemente quando perto
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 140 * 140) {
            const s = 280;
            const inv = 1 / (Math.sqrt(d2) + 0.001);
            this.x += dx * inv * s * dt;
            this.y += dy * inv * s * dt;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(120,255,170,.9)";
        ctx.fill();

        ctx.restore();
    }
}
