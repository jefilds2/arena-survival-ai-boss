import { CFG } from "../constants.js";
import { norm } from "../math.js";

export class Enemy {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.r = CFG.enemies.radius;
        this.hp = CFG.enemies.hp;
        this.speed = CFG.enemies.speed;
        this.dead = false;
    }

    hit(dmg) {
        this.hp -= dmg;
        if (this.hp <= 0) this.dead = true;
    }

    update(game, dt) {
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const n = norm(dx, dy);

        this.x += n.x * this.speed * dt;
        this.y += n.y * this.speed * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,80,80,.85)";
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,0,0,.35)";
        ctx.stroke();

        ctx.restore();
    }
}
