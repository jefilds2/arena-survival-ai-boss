import { CFG } from "../constants.js";
import { clamp, norm } from "../math.js";

export class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.r = CFG.player.radius;

        this.hp = CFG.player.maxHp;
        this.maxHp = CFG.player.maxHp;

        this.level = 1;
        this.xp = 0;
        this.xpNext = (CFG.leveling?.baseXp ?? 40);

        this.dmg = 10;
        this.fireRate = 4.0; // tiros/seg
        this.bulletSpeedMul = 1.0;

        // dash
        this.dashing = 0;
        this.dashCd = 0;

        this.shotCd = 0;
    }

    giveXp(amount) {
        this.xp += amount;
    }

    update(game, dt) {
        // Dash cooldowns
        this.dashCd = Math.max(0, this.dashCd - dt);
        this.dashing = Math.max(0, this.dashing - dt);

        // Movement
        let mx = 0, my = 0;
        if (game.input.down("w")) my -= 1;
        if (game.input.down("s")) my += 1;
        if (game.input.down("a")) mx -= 1;
        if (game.input.down("d")) mx += 1;

        const n = norm(mx, my);
        const speed = this.dashing > 0 ? CFG.player.dashSpeed : CFG.player.speed;

        this.vx = n.x * speed;
        this.vy = n.y * speed;

        if (game.input.pressed(" ") && this.dashCd <= 0) {
            this.dashing = CFG.player.dashTime;
            this.dashCd = CFG.player.dashCooldown;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Clamp to arena
        this.x = clamp(this.x, CFG.arenaPadding, game.w - CFG.arenaPadding);
        this.y = clamp(this.y, CFG.arenaPadding, game.h - CFG.arenaPadding);

        // Auto-shoot
        this.shotCd = Math.max(0, this.shotCd - dt);
        if (this.shotCd <= 0) {
            const target = game.findNearestEnemy(this.x, this.y);
            if (target) {
                game.spawnBullet(this.x, this.y, target.x, target.y, this.dmg, this.bulletSpeedMul);
                this.shotCd = 1 / this.fireRate;
            }
        }

        // Level up check
        while (this.xp >= this.xpNext) {
            this.xp -= this.xpNext;
            this.level++;
            this.xpNext = Math.floor(this.xpNext * (CFG.leveling?.growth ?? 1.22));
            game.queueLevelUp();
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // body
        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.fill();

        // outline
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,0,0,.35)";
        ctx.stroke();

        ctx.restore();
    }
}
