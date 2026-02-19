import { CFG } from "../constants.js";
import { norm } from "../math.js";

export class Bullet {
    constructor(x, y, tx, ty, dmg, speedMul) {
        this.x = x; this.y = y;
        this.r = CFG.bullet.radius;
        this.dmg = dmg;

        const n = norm(tx - x, ty - y);
        this.vx = n.x * CFG.bullet.speed * speedMul;
        this.vy = n.y * CFG.bullet.speed * speedMul;

        this.ttl = CFG.bullet.ttl;
        this.dead = false;
    }

    update(_game, dt) {
        this.ttl -= dt;
        if (this.ttl <= 0) this.dead = true;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(180,220,255,.95)";
        ctx.fill();

        ctx.restore();
    }
}
