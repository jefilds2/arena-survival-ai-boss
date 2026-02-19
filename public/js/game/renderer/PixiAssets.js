import { VISUAL } from "./visualConfig.js";

export class PixiAssets {
    constructor(PIXI) {
        this.PIXI = PIXI;
        this.tex = {};
    }

    _makeProceduralFloor() {
        const c = document.createElement("canvas");
        c.width = 256;
        c.height = 256;
        const ctx = c.getContext("2d");

        // base
        ctx.fillStyle = "#0a0f19";
        ctx.fillRect(0, 0, c.width, c.height);

        // grid
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 256; i += 32) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
        }

        // noise speckle
        for (let i = 0; i < 1200; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            const a = Math.random() * 0.06;
            ctx.fillStyle = `rgba(255,255,255,${a})`;
            ctx.fillRect(x, y, 1, 1);
        }

        return this.PIXI.Texture.from(c);
    }

    async load() {
        const PIXI = this.PIXI;

        const safeLoad = async (key, url, fallbackTex) => {
            try {
                const t = await PIXI.Assets.load(url);
                this.tex[key] = t;
            } catch {
                this.tex[key] = fallbackTex;
            }
        };

        const white = PIXI.Texture.WHITE;
        await safeLoad("floor", VISUAL.tiles.floor, this._makeProceduralFloor());

        await safeLoad("player", VISUAL.sprites.player, white);
        await safeLoad("enemy", VISUAL.sprites.enemy, white);
        await safeLoad("boss", VISUAL.sprites.boss, white);
        await safeLoad("bullet", VISUAL.sprites.bullet, white);

        return this.tex;
    }
}
