// public/js/game/renderer/PixiRenderer.js
export class PixiRenderer {
    constructor({ canvas }) {
        this.canvas = canvas;

        this.app = null;
        this.stage = null;

        this.floor = null;
        this.world = null;
        this.fx = null;

        this._player = null;
        this._boss = null;

        this._enemies = new Map();
        this._bullets = new Map();
        this._orbs = new Map();

        // escalas (ajuste fino depois)
        this.SCALE_PLAYER = 0.8;
        this.SCALE_ENEMY = 2.5;
        this.SCALE_BOSS = 3;

        // resolve assets a partir do arquivo atual
        this._root = new URL("../../../", import.meta.url);

        this._anims = {
            player: null,
            enemy4: null,
            boss4: null,
        };
    }

    // ------------------------
    // INIT
    // ------------------------
    async init() {
        const PIXI = window.PIXI;
        if (!PIXI) throw new Error("PIXI não carregou. Confere os CDNs no index.html.");
        this.PIXI = PIXI;

        // pixel art defaults (Pixi v8)
        if (PIXI.settings) {
            if (PIXI.SCALE_MODES) PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
            if ("ROUND_PIXELS" in PIXI.settings) PIXI.settings.ROUND_PIXELS = true;
        }

        this.app = new PIXI.Application();
        await this.app.init({
            canvas: this.canvas,
            resizeTo: window,
            antialias: false,
            backgroundAlpha: 0,
            autoDensity: true,
            resolution: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
        });

        // garante pixelated sem quebrar
        const view = this.app.canvas || this.canvas;
        if (view && view.style) view.style.imageRendering = "pixelated";

        this.stage = this.app.stage;
        this.stage.sortableChildren = true;

        // chão: tenta floor.png, fallback procedural
        const floorTex = await this._loadFloorTexture([
            "assets/tiles/floor.png",
            "assets/tiles/Floor.png",
        ]);
        this.floor = new PIXI.TilingSprite(floorTex, this.app.screen.width, this.app.screen.height);
        this.floor.zIndex = 0;
        this.stage.addChild(this.floor);

        // mundo
        this.world = new PIXI.Container();
        this.world.sortableChildren = true;
        this.world.zIndex = 1;
        this.stage.addChild(this.world);

        // fx
        this.fx = new PIXI.Container();
        this.fx.sortableChildren = true;
        this.fx.zIndex = 9999;
        this.world.addChild(this.fx);

        // assets
        await this._loadAllAnimations();

        // garante floor sempre cobrindo
        this.app.ticker.add(() => {
            if (this.floor) {
                this.floor.width = this.app.screen.width;
                this.floor.height = this.app.screen.height;
            }
        });

        window.__pixi = this.app;
    }

    // ------------------------
    // DRAW
    // ------------------------
    draw(state) {
        if (!state || !state.player) return;

        // floor fullscreen
        this.floor.width = this.app.screen.width;
        this.floor.height = this.app.screen.height;

        // camera
        const camX = state.camera?.x ?? state.player.x ?? 0;
        const camY = state.camera?.y ?? state.player.y ?? 0;

        this.world.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
        this.world.pivot.set(camX, camY);

        // tile anda
        this.floor.tilePosition.set(-camX, -camY);

        // player
        this._player = this._upsertPlayer(this._player, state.player);

        // boss
        if (state.boss) {
            this._boss = this._upsertDirActor(
                this._boss,
                state.boss,
                this._anims.boss4,
                this.SCALE_BOSS,
                "boss"
            );
        } else if (this._boss) {
            this._boss.destroy?.();
            this._boss = null;
        }

        // enemies
        this._syncListSprites(this._enemies, state.enemies ?? [], () => {
            return this._createDirActorSprite(this._anims.enemy4, this.SCALE_ENEMY, "enemy");
        });

        // bullets
        this._syncListSprites(this._bullets, state.bullets ?? [], () => {
            const g = new this.PIXI.Graphics();
            g.circle(0, 0, 3).fill(0xffffff);
            g.zIndex = 5000;
            this.world.addChild(g);
            return g;
        });

        // orbs
        this._syncListSprites(this._orbs, state.orbs ?? [], () => {
            const g = new this.PIXI.Graphics();
            g.circle(0, 0, 6).fill(0x2cff7a);
            g.zIndex = 100;
            this.world.addChild(g);
            return g;
        });

        // atualiza enemies
        for (const [id, sp] of this._enemies) {
            const e = this._lastListFind(state.enemies, id);
            if (!e) continue;

            this._updateDirActor(sp, e, this._anims.enemy4, this.SCALE_ENEMY);
            sp.position.set(e.x, e.y);
            sp.zIndex = sp.y;
        }

        // bullets
        for (const [id, sp] of this._bullets) {
            const b = this._lastListFind(state.bullets, id);
            if (!b) continue;
            sp.position.set(b.x, b.y);
        }

        // orbs
        for (const [id, sp] of this._orbs) {
            const o = this._lastListFind(state.orbs, id);
            if (!o) continue;
            sp.position.set(o.x, o.y);
            sp.zIndex = sp.y - 999;
        }
    }

    // ------------------------
    // FX
    // ------------------------
    hitFx(x, y) {
        const p = new this.PIXI.Graphics();
        p.circle(0, 0, 8).fill(0xaa0000);
        p.position.set(x, y);
        p.alpha = 0.9;
        p.zIndex = y + 1;
        this.fx.addChild(p);

        const start = performance.now();
        const tick = () => {
            const t = (performance.now() - start) / 250;
            p.alpha = 0.9 * (1 - t);
            this._setScale(p, 1 + t * 0.8, 1 + t * 0.8);
            if (t >= 1) p.destroy?.();
            else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    damageText(x, y, dmg) {
        const txt = new this.PIXI.Text(String(dmg), {
            fontSize: 14,
            fill: 0xffffff,
            stroke: 0x000000,
            strokeThickness: 3,
        });
        this._setAnchor(txt, 0.5, 1);
        txt.position.set(x, y - 10);
        txt.zIndex = y + 999;
        this.fx.addChild(txt);

        const start = performance.now();
        const tick = () => {
            const t = (performance.now() - start) / 500;
            txt.y = (y - 10) - t * 18;
            txt.alpha = 1 - t;
            if (t >= 1) txt.destroy?.();
            else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    // ============================================================
    // PLAYER (strip 1 row + flip)
    // ============================================================
    _upsertPlayer(current, data) {
        const PIXI = this.PIXI;
        const anims = this._anims.player;

        if (current && !this._isAnimatedSprite(current)) {
            current.destroy?.();
            current = null;
        }

        if (!anims) {
            if (!current) {
                const g = new PIXI.Graphics();
                g.circle(0, 0, 10).fill(0xffffff);
                this.world.addChild(g);
                current = g;
            }
            current.position.set(data.x, data.y);
            current.zIndex = current.y;
            return current;
        }

        if (!current) {
            const sp = new PIXI.AnimatedSprite(anims.idle);
            this._setAnchor(sp, 0.5, 0.86);
            sp.animationSpeed = 0.16;
            sp.loop = true;
            sp.play();
            sp._animKey = "idle";
            sp._lastFlip = 1;
            this.world.addChild(sp);
            current = sp;
        }

        const vx = Number(data.vx ?? 0);
        const vy = Number(data.vy ?? 0);
        const moving = Math.abs(vx) + Math.abs(vy) > 0.02;

        let key = "idle";
        if (data.dead) key = "death";
        else if (data.attacking) key = "attack";
        else if (moving) key = anims.run ? "run" : "walk";

        this._setAnimSingle(current, anims, key);

        current.position.set(data.x, data.y);
        current.zIndex = current.y;

        let dirX = data.dirX;
        if (!Number.isFinite(dirX)) {
            if (Math.abs(vx) > 0.03) dirX = Math.sign(vx);
            else dirX = current._lastFlip;
        }
        const flip = dirX < 0 ? -1 : 1;
        current._lastFlip = flip;

        this._setScale(current, this.SCALE_PLAYER * flip, this.SCALE_PLAYER);
        return current;
    }

    _setAnimSingle(sp, anims, key) {
        if (sp._animKey === key) return;

        const tex = anims[key] || anims.idle;
        sp.textures = tex;
        sp._animKey = key;

        if (key === "death") {
            sp.loop = false;
            sp.animationSpeed = 0.12;
            sp.gotoAndPlay(0);
            return;
        }

        sp.loop = true;
        sp.animationSpeed = key === "attack" ? 0.22 : 0.16;
        sp.gotoAndPlay(0);
    }

    // ============================================================
    // ENEMY/BOSS (4-dir rows)
    // ============================================================
    _createDirActorSprite(anims4, scale, label) {
        const PIXI = this.PIXI;

        if (!anims4) {
            const g = new PIXI.Graphics();
            g.roundRect(-12, -12, 24, 24, 6).fill(0x8aa8ff);
            g._dir = "down";
            g._action = "idle";
            g._label = label;
            this._setScale(g, scale, scale);
            this.world.addChild(g);
            return g;
        }

        const sp = new PIXI.AnimatedSprite(anims4.idle.down);
        this._setAnchor(sp, 0.5, 0.86);
        sp.animationSpeed = 0.15;
        sp.loop = true;
        sp.play();

        sp._dir = "down";
        sp._action = "idle";
        sp._label = label;

        this._setScale(sp, scale, scale);
        this.world.addChild(sp);
        return sp;
    }

    _upsertDirActor(current, data, anims4, scale, label) {
        if (current && anims4 && !this._isAnimatedSprite(current)) {
            current.destroy?.();
            current = null;
        }
        if (!current) current = this._createDirActorSprite(anims4, scale, label);

        this._updateDirActor(current, data, anims4, scale);
        current.position.set(data.x, data.y);
        current.zIndex = current.y;
        return current;
    }

    _updateDirActor(sp, data, anims4, scale) {
        if (!anims4 || !this._isAnimatedSprite(sp)) {
            this._setScale(sp, scale, scale);
            return;
        }

        const vx = Number(data.vx ?? 0);
        const vy = Number(data.vy ?? 0);
        const moving = Math.abs(vx) + Math.abs(vy) > 0.02;

        let action = "idle";
        if (data.dead) action = "death";
        else if (data.attacking) action = "attack";
        else if (moving) action = "walk";

        let dir = sp._dir || "down";

        const dx = Number(data.dirX ?? 0);
        const dy = Number(data.dirY ?? 0);
        const useX = Math.abs(dx) > 0.1 ? dx : vx;
        const useY = Math.abs(dy) > 0.1 ? dy : vy;

        if (Math.abs(useX) + Math.abs(useY) > 0.05) {
            if (Math.abs(useX) > Math.abs(useY)) dir = useX >= 0 ? "right" : "left";
            else dir = useY >= 0 ? "down" : "up";
        }

        if (sp._action !== action || sp._dir !== dir) {
            sp._action = action;
            sp._dir = dir;

            const set = anims4[action] || anims4.idle;
            const tex = set[dir] || set.down || anims4.idle.down;
            sp.textures = tex;

            if (action === "death") {
                sp.loop = false;
                sp.animationSpeed = 0.12;
                sp.gotoAndPlay(0);
            } else {
                sp.loop = true;
                sp.animationSpeed = action === "attack" ? 0.18 : 0.15;
                sp.gotoAndPlay(0);
            }
        }

        this._setScale(sp, scale, scale);
    }

    // ============================================================
    // LIST SYNC
    // ============================================================
    _syncListSprites(map, list, factory) {
        const ids = new Set();

        for (let i = 0; i < list.length; i++) {
            const item = list[i];

            let id = item.id ?? item._id;
            if (!id) {
                id = (crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`);
                item._id = id;
            }

            ids.add(id);

            if (!map.has(id)) {
                const sp = factory(item);
                map.set(id, sp);
            }
        }

        for (const [id, sp] of map) {
            if (!ids.has(id)) {
                sp.destroy?.();
                map.delete(id);
            }
        }
    }

    _lastListFind(list, id) {
        if (!list) return null;
        for (let i = 0; i < list.length; i++) {
            const it = list[i];
            const iid = it.id ?? it._id;
            if (iid === id) return it;
        }
        return null;
    }

    // ============================================================
    // LOADING
    // ============================================================
    async _loadAllAnimations() {
        this._anims.player = await this._loadPlayerSet(["assets/player/"]);
        this._anims.enemy4 = await this._loadVampire4DirSet(["assets/vampires/"]);
        this._anims.boss4 = await this._loadVampire4DirSet([
            "assets/boss-vampire/",
        ]);
    }

    async _loadPlayerSet(baseCandidates) {
        const files = {
            idle: "idle.png",
            walk: "walk.png",
            run: "run.png",
            attack: "attack.png",
            hurt: "hurt.png",
            death: "death.png",
        };

        const out = {};
        for (const [k, file] of Object.entries(files)) {
            out[k] = null;
            for (const base of baseCandidates) {
                const url = this._u(base + file);
                try {
                    out[k] = await this._loadStripTexturesSingleRow(url);
                    break;
                } catch (_) { }
            }
        }

        if (!out.idle) return null;
        if (!out.walk) out.walk = out.idle;
        if (!out.run) out.run = out.walk;
        if (!out.attack) out.attack = out.walk;
        if (!out.hurt) out.hurt = out.idle;
        if (!out.death) out.death = out.hurt;

        return out;
    }

    async _loadVampire4DirSet(baseCandidates) {
        const files = {
            idle: "idle.png",
            walk: "walk.png",
            attack: "attack.png",
            hurt: "hurt.png",
            death: "death.png",
        };

        for (const base of baseCandidates) {
            try {
                const set = {};
                for (const [k, file] of Object.entries(files)) {
                    const url = this._u(base + file);
                    set[k] = await this._loadSheet4DirAuto(url, { rows: 4, prefer: [8, 6, 4] });
                }

                if (!set.walk) set.walk = set.idle;
                if (!set.attack) set.attack = set.walk;
                if (!set.hurt) set.hurt = set.idle;
                if (!set.death) set.death = set.hurt;

                return set;
            } catch (_) { }
        }

        return null;
    }

    _u(rel) {
        return new URL(rel, this._root).href;
    }

    async _loadStripTexturesSingleRow(url) {
        const img = await this._loadImage(url);

        // player: frames quadrados, largura = altura
        const fw = img.height;
        const fh = img.height;
        const frames = Math.max(1, Math.floor(img.width / fw));

        const out = [];
        for (let i = 0; i < frames; i++) {
            const c = document.createElement("canvas");
            c.width = fw;
            c.height = fh;

            const ctx = c.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, fw, fh);
            ctx.drawImage(img, i * fw, 0, fw, fh, 0, 0, fw, fh);

            const t = this.PIXI.Texture.from(c);
            this._nearestTexture(t);
            out.push(t);
        }

        return out;
    }

    // --------- AUTO GRID (corrige half-body/flicker) ----------
    async _loadSheet4DirAuto(url, { rows = 4, prefer = [8, 6, 4] } = {}) {
        const img = await this._loadImage(url);

        const H = img.height;
        const W = img.width;

        const frameH = Math.floor(H / rows) || H;
        const best = this._inferFramesPerRow(img, { rows, frameH, prefer });

        // debug útil (pode comentar depois)
        // console.info("[sheet]", url.split("/").pop(), { W, H, ...best });

        return this._sliceSheet4Dir(img, {
            rows,
            framesPerRow: best.framesPerRow,
            frameW: best.frameW,
            frameH: best.frameH,
        });
    }

    _inferFramesPerRow(img, { rows, frameH, prefer }) {
        const W = img.width;
        const H = img.height;

        const candidates = [];
        for (let n = 3; n <= 16; n++) {
            if (W % n !== 0) continue;
            const fw = W / n;
            const fh = frameH;

            // limites plausíveis p/ pixel art
            if (fw < 16 || fw > 512) continue;

            const ratio = fw / fh;
            if (ratio < 0.35 || ratio > 1.75) continue;

            let score = 0;

            // preferências comuns
            const prefIdx = prefer.indexOf(n);
            if (prefIdx >= 0) score += (prefer.length - prefIdx) * 2;

            // múltiplos de 8/16 costumam ser sprite-friendly
            if (fw % 8 === 0) score += 1;
            if (fh % 8 === 0) score += 1;

            // heurística por “clipping” em alguns frames
            score += this._scoreCandidateByAlpha(img, { fw, fh, framesPerRow: n, rows });

            candidates.push({ framesPerRow: n, frameW: fw, frameH: fh, score });
        }

        // fallback seguro
        if (!candidates.length) {
            const n = 8;
            return { framesPerRow: n, frameW: Math.floor(W / n), frameH };
        }

        candidates.sort((a, b) => b.score - a.score);
        return candidates[0];
    }

    _scoreCandidateByAlpha(img, { fw, fh, framesPerRow, rows }) {
        // amostra poucos frames da primeira linha
        const sample = [0, Math.floor(framesPerRow / 2), Math.max(0, framesPerRow - 1)];
        const c = document.createElement("canvas");
        c.width = fw;
        c.height = fh;
        const ctx = c.getContext("2d", { willReadFrequently: true });

        let score = 0;

        for (const i of sample) {
            ctx.clearRect(0, 0, fw, fh);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, i * fw, 0 * fh, fw, fh, 0, 0, fw, fh);

            const data = ctx.getImageData(0, 0, fw, fh).data;

            let minX = fw, minY = fh, maxX = -1, maxY = -1;
            const thr = 10;

            for (let y = 0; y < fh; y++) {
                for (let x = 0; x < fw; x++) {
                    const a = data[(y * fw + x) * 4 + 3];
                    if (a > thr) {
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                    }
                }
            }

            // frame vazio? penaliza
            if (maxX < 0 || maxY < 0) {
                score -= 1.5;
                continue;
            }

            const usedW = (maxX - minX + 1) / fw;

            // se encosta demais nas bordas, provável que fw esteja pequeno (cortando metade)
            if (minX <= 0 || maxX >= fw - 1) score -= 2.0;

            // se ocupa muito pouco, fw pode estar grande demais
            if (usedW < 0.25) score -= 1.0;

            // zona boa (nem clipado, nem muito “vazio”)
            if (usedW >= 0.35 && usedW <= 0.95) score += 1.0;
        }

        return score;
    }

    _sliceSheet4Dir(img, { rows = 4, framesPerRow = 8, frameW, frameH }) {
        const dirs = ["down", "up", "right", "left"]; // row0..3
        const out = {};

        for (let r = 0; r < rows; r++) {
            const dir = dirs[r] || `row${r}`;
            out[dir] = [];

            for (let i = 0; i < framesPerRow; i++) {
                const c = document.createElement("canvas");
                c.width = frameW;
                c.height = frameH;

                const ctx = c.getContext("2d");
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, frameW, frameH);

                ctx.drawImage(
                    img,
                    i * frameW,
                    r * frameH,
                    frameW,
                    frameH,
                    0,
                    0,
                    frameW,
                    frameH
                );

                const t = this.PIXI.Texture.from(c);
                this._nearestTexture(t);
                out[dir].push(t);
            }
        }

        return out;
    }

    _nearestTexture(t) {
        if (t?.baseTexture && this.PIXI?.SCALE_MODES) t.baseTexture.scaleMode = this.PIXI.SCALE_MODES.NEAREST;
        if (t?.source && this.PIXI?.SCALE_MODES) t.source.scaleMode = this.PIXI.SCALE_MODES.NEAREST;
    }

    _loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.decoding = "async";
            img.src = src;
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
        });
    }

    // ============================================================
    // FLOOR (floor.png)
    // ============================================================
    async _loadFloorTexture(candidates) {
        for (const rel of candidates) {
            const url = this._u(rel);
            try {
                const img = await this._loadImage(url);
                const tex = this.PIXI.Texture.from(img);
                this._nearestTexture(tex);
                return tex;
            } catch (_) { }
        }

        // fallback procedural
        const tex = this._makeFloorTileTexture();
        this._nearestTexture(tex);
        return tex;
    }

    _makeFloorTileTexture() {
        const c = document.createElement("canvas");
        c.width = 256;
        c.height = 256;
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = false;

        ctx.fillStyle = "#0a0f16";
        ctx.fillRect(0, 0, 256, 256);

        for (let y = 0; y < 256; y += 32) {
            const shade = 10 + ((y / 32) % 2) * 10;
            ctx.fillStyle = `rgb(${shade},${shade + 10},${shade + 18})`;
            ctx.fillRect(0, y, 256, 32);

            ctx.fillStyle = "rgba(0,0,0,0.38)";
            ctx.fillRect(0, y + 31, 256, 1);
        }

        for (let i = 0; i < 2600; i++) {
            const x = (Math.random() * 256) | 0;
            const y = (Math.random() * 256) | 0;
            const a = Math.random() * 0.10;
            ctx.fillStyle = `rgba(255,255,255,${a})`;
            ctx.fillRect(x, y, 1, 1);
        }

        const g = ctx.createRadialGradient(128, 128, 40, 128, 128, 170);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);

        return this.PIXI.Texture.from(c);
    }

    // ============================================================
    // HELPERS
    // ============================================================
    _isAnimatedSprite(obj) {
        return !!(obj && obj.textures && typeof obj.gotoAndPlay === "function" && typeof obj.play === "function");
    }

    _setScale(obj, sx, sy) {
        if (!obj) return;
        const s = obj.scale;
        if (!s) return;
        if (typeof s.set === "function") s.set(sx, sy);
        else {
            s.x = sx;
            s.y = sy;
        }
    }

    _setAnchor(obj, ax, ay) {
        if (!obj) return;
        const a = obj.anchor;
        if (!a) return;
        if (typeof a.set === "function") a.set(ax, ay);
        else {
            a.x = ax;
            a.y = ay;
        }
    }
}
