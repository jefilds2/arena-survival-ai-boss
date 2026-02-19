// public/js/game/renderer/PixiRenderer.js
export class PixiRenderer {
    constructor({ canvas }) {
        this.canvas = canvas;

        this.app = null;
        this.stage = null;

        this.floor = null; // tiling floor (screen space)
        this.world = null; // world space container (camera)
        this.fx = null;

        this._player = null;
        this._boss = null;

        this._enemies = new Map();
        this._bullets = new Map();
        this._orbs = new Map();

        // escalas (serão recalculadas por altura alvo quando os sprites carregarem)
        this.SCALE_PLAYER = 0.5;
        this.SCALE_ENEMY = 1.0;
        this.SCALE_BOSS = 2.0;

        // altura alvo (em “pixels do mundo”)
        this.TARGET_H_ENEMY = 64; // vampiro comum
        this.TARGET_H_PLAYER = 64; // player mesmo tamanho do vampiro
        this.TARGET_H_BOSS = 128; // boss maior

        this._anims = {
            player: null,  // { idle:[...], walk:[...], ... , _meta:{frameH,frameW} }
            enemy4: null,  // { idle:{down:[...],...}, walk:{...}, ... , _meta:{frameH,frameW,framesPerRow,rows} }
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

        // ✅ defaults p/ pixel art (Pixi v8)
        if (PIXI.settings) {
            if (PIXI.SCALE_MODES) PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
            if ("ROUND_PIXELS" in PIXI.settings) PIXI.settings.ROUND_PIXELS = true;
        }

        this.app = new PIXI.Application();
        await this.app.init({
            canvas: this.canvas,
            resizeTo: this.canvas.parentElement ?? window,
            antialias: false,
            backgroundAlpha: 0,
            autoDensity: true,
            resolution: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
        });

        // CSS pixelated (sem quebrar se algo vier undefined)
        try {
            const view = this.app.canvas || this.canvas;
            if (view && view.style) view.style.imageRendering = "pixelated";
        } catch { }

        this.stage = this.app.stage;
        this.stage.sortableChildren = true;

        // containers
        this.world = new PIXI.Container();
        this.world.sortableChildren = true;
        this.world.zIndex = 1;
        this.stage.addChild(this.world);

        this.fx = new PIXI.Container();
        this.fx.sortableChildren = true;
        this.fx.zIndex = 9999;
        this.world.addChild(this.fx);

        // assets (player + vampiros + boss)
        await this._loadAllAnimations();

        // recalcula escala por altura (player = vampiro, boss maior)
        this._recalcScalesByMeta();

        // floor (tenta tile real, senão procedural)
        const floorTex = await this._loadFloorTextureOrFallback();
        this.floor = this._makeTilingSprite(floorTex, this.app.screen.width, this.app.screen.height);
        this.floor.zIndex = 0;
        this.stage.addChildAt(this.floor, 0);

        // mantém floor cobrindo sempre
        this.app.ticker.add(() => {
            if (!this.floor) return;
            this.floor.width = this.app.screen.width;
            this.floor.height = this.app.screen.height;
        });

        window.__pixi = this.app;
    }

    // ------------------------
    // DRAW
    // ------------------------
    draw(state) {
        if (!state || !state.player) return;

        // floor fullscreen
        if (this.floor) {
            this.floor.width = this.app.screen.width;
            this.floor.height = this.app.screen.height;
        }

        // camera segue player (mundo “infinito”)
        const camX = state.camera?.x ?? state.player.x ?? 0;
        const camY = state.camera?.y ?? state.player.y ?? 0;

        this.world.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
        this.world.pivot.set(camX, camY);

        // tile anda com a câmera
        if (this.floor) this.floor.tilePosition.set(-camX, -camY);

        // PLAYER
        this._player = this._upsertPlayer(this._player, state.player);

        // BOSS
        if (state.boss) {
            this._boss = this._upsertDirActor(this._boss, state.boss, this._anims.boss4, this.SCALE_BOSS, "boss");
        } else if (this._boss) {
            this._boss.destroy?.();
            this._boss = null;
        }

        // ENEMIES
        this._syncListSprites(this._enemies, state.enemies ?? [], () => {
            return this._createDirActorSprite(this._anims.enemy4, this.SCALE_ENEMY, "enemy");
        });

        // BULLETS
        this._syncListSprites(this._bullets, state.bullets ?? [], () => {
            const g = new this.PIXI.Graphics();
            g.beginFill(0xffffff);
            g.drawCircle(0, 0, 3);
            g.endFill();
            g.zIndex = 5000;
            this.world.addChild(g);
            return g;
        });

        // ORBS (xp)
        this._syncListSprites(this._orbs, state.orbs ?? [], () => {
            const g = new this.PIXI.Graphics();
            g.beginFill(0x2cff7a);
            g.drawCircle(0, 0, 6);
            g.endFill();
            g.zIndex = 100;
            this.world.addChild(g);
            return g;
        });

        // update enemies positions + anim
        for (const [id, sp] of this._enemies) {
            const e = this._lastListFind(state.enemies, id);
            if (!e) continue;
            this._updateDirActor(sp, e, this._anims.enemy4, this.SCALE_ENEMY);
            sp.position.set(e.x, e.y);
            sp.zIndex = sp.y;
        }

        // bullets positions
        for (const [id, sp] of this._bullets) {
            const b = this._lastListFind(state.bullets, id);
            if (!b) continue;
            sp.position.set(b.x, b.y);
        }

        // orbs positions
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
        p.beginFill(0xaa0000);
        p.drawCircle(0, 0, 8);
        p.endFill();
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
    // PLAYER (strip 1 row + flip estável)
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
                g.beginFill(0xffffff);
                g.drawCircle(0, 0, 10);
                g.endFill();
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
    // ENEMY/BOSS (4-dir sheets)
    // ============================================================
    _createDirActorSprite(anims4, scale, label) {
        const PIXI = this.PIXI;

        if (!anims4) {
            const g = new PIXI.Graphics();
            g.beginFill(0x8aa8ff);
            g.drawRoundedRect(-12, -12, 24, 24, 6);
            g.endFill();
            g._dir = "down";
            g._action = "idle";
            g._label = label;
            g._px = null;
            g._py = null;
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

        // pra direção baseada em movimento sem depender de vx/vy
        sp._px = null;
        sp._py = null;

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
        // placeholder
        if (!anims4 || !this._isAnimatedSprite(sp)) {
            this._setScale(sp, scale, scale);
            return;
        }

        // direção por delta de posição (robusto mesmo se Enemy não tiver vx/vy)
        const px = (sp._px ?? data.x);
        const py = (sp._py ?? data.y);
        const dxPos = data.x - px;
        const dyPos = data.y - py;
        sp._px = data.x;
        sp._py = data.y;

        const vx = Number.isFinite(data.vx) ? Number(data.vx) : dxPos;
        const vy = Number.isFinite(data.vy) ? Number(data.vy) : dyPos;

        const moving = Math.abs(vx) + Math.abs(vy) > 0.02;

        let action = "idle";
        if (data.dead) action = "death";
        else if (data.attacking) action = "attack";
        else if (moving) action = "walk";

        let dir = sp._dir || "down";

        const useX = Number.isFinite(data.dirX) ? Number(data.dirX) : vx;
        const useY = Number.isFinite(data.dirY) ? Number(data.dirY) : vy;

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
        // player
        this._anims.player = await this._loadPlayerSet([
            "/assets/player/",
            "assets/player/",
        ]);

        // vampiros comuns
        this._anims.enemy4 = await this._loadVampire4DirSet([
            "/assets/vampires/",
            "assets/vampires/",
        ]);

        // boss (aceita as duas pastas)
        this._anims.boss4 = await this._loadVampire4DirSet([
            "/assets/vampire-boss/",
            "/assets/boss-vampire/",
            "assets/vampire-boss/",
            "assets/boss-vampire/",
        ]);
    }

    _recalcScalesByMeta() {
        const pH = this._anims.player?._meta?.frameH;
        const eH = this._anims.enemy4?._meta?.frameH;
        const bH = this._anims.boss4?._meta?.frameH;

        if (Number.isFinite(pH) && pH > 0) this.SCALE_PLAYER = this.TARGET_H_PLAYER / pH;
        if (Number.isFinite(eH) && eH > 0) this.SCALE_ENEMY = this.TARGET_H_ENEMY / eH;
        if (Number.isFinite(bH) && bH > 0) this.SCALE_BOSS = this.TARGET_H_BOSS / bH;

        // fallback mínimo (evita 0)
        this.SCALE_PLAYER = this.SCALE_PLAYER || 0.5;
        this.SCALE_ENEMY = this.SCALE_ENEMY || 1.0;
        this.SCALE_BOSS = this.SCALE_BOSS || 2.0;
    }

    async _loadPlayerSet(baseCandidates) {
        // tenta vários nomes (case + sinônimos)
        const files = {
            idle: ["idle.png", "Idle.png", "IDLE.png"],
            walk: ["walk.png", "Walk.png", "walking.png", "Walking.png"],
            run: ["run.png", "Run.png"],
            attack: ["attack.png", "Attack.png", "atk.png", "Atk.png"],
            hurt: ["hurt.png", "Hurt.png", "hit.png", "Hit.png", "damage.png", "Damage.png"],
            death: ["death.png", "Death.png", "die.png", "Die.png"],
        };

        const out = {};
        let meta = null;

        for (const [k, names] of Object.entries(files)) {
            out[k] = null;

            for (const base of baseCandidates) {
                for (const name of names) {
                    const url = this._join(base, name);
                    try {
                        const pack = await this._loadStripTexturesSingleRow(url);
                        out[k] = pack.textures;
                        meta = meta || pack.meta;
                        break;
                    } catch (_) { }
                }
                if (out[k]) break;
            }
        }

        if (!out.idle) return null;

        // fallback actions
        if (!out.walk) out.walk = out.idle;
        if (!out.run) out.run = out.walk;
        if (!out.attack) out.attack = out.walk;
        if (!out.hurt) out.hurt = out.idle;
        if (!out.death) out.death = out.hurt;

        out._meta = meta || { frameH: 128, frameW: 128 };
        return out;
    }

    async _loadVampire4DirSet(baseCandidates) {
        const files = {
            idle: ["idle.png", "Idle.png"],
            walk: ["walk.png", "Walk.png", "walking.png", "Walking.png"],
            attack: ["attack.png", "Attack.png"],
            hurt: ["hurt.png", "Hurt.png", "hit.png", "Hit.png"],
            death: ["death.png", "Death.png", "die.png", "Die.png"],
        };

        for (const base of baseCandidates) {
            try {
                const set = {};
                let meta = null;

                for (const [k, names] of Object.entries(files)) {
                    let loaded = null;

                    for (const name of names) {
                        const url = this._join(base, name);
                        try {
                            const pack = await this._loadSheet4DirAuto(url, { rows: 4 });
                            loaded = pack.textures4;
                            meta = meta || pack.meta;
                            break;
                        } catch (_) { }
                    }

                    if (!loaded) throw new Error(`missing ${k} in ${base}`);
                    set[k] = loaded;
                }

                if (!set.walk) set.walk = set.idle;
                if (!set.attack) set.attack = set.walk;
                if (!set.hurt) set.hurt = set.idle;
                if (!set.death) set.death = set.hurt;

                set._meta = meta || { frameH: 64, frameW: 48, framesPerRow: 8, rows: 4 };
                return set;
            } catch (_) { }
        }

        return null;
    }

    _join(base, file) {
        if (!base.endsWith("/")) base += "/";
        // base pode ser "/assets/.." ou "assets/.."
        const b = base.startsWith("/") ? base : `/${base}`;
        return `${b}${file}`.replaceAll("//", "/");
    }

    async _loadStripTexturesSingleRow(url) {
        const img = await this._loadImage(url);

        // regra: frames quadrados (w = h) — funciona pro seu player
        const fh = img.height;
        const fw = img.height;
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

        return { textures: out, meta: { frameW: fw, frameH: fh, framesPerRow: frames, rows: 1 } };
    }

    async _loadSheet4DirAuto(url, { rows = 4 } = {}) {
        const img = await this._loadImage(url);

        const frameH = Math.floor(img.height / rows);
        if (frameH <= 0) throw new Error(`frameH inválido em ${url}`);

        // tenta deduzir frames por linha e frameW (3..12 frames)
        const guess = this._guessFramesPerRow(img.width, frameH);
        const framesPerRow = guess.framesPerRow;
        const frameW = guess.frameW;

        const dirs = ["down", "left", "right", "up"]; // ordem mais comum em packs 4-dir

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
                    i * frameW, r * frameH, frameW, frameH,
                    0, 0, frameW, frameH
                );

                const t = this.PIXI.Texture.from(c);
                this._nearestTexture(t);
                out[dir].push(t);
            }
        }

        // monta no formato esperado: {idle:{down:[]...}, walk:{...}} em quem chama
        const textures4 = {
            down: out.down || out.row0,
            up: out.up || out.row3,
            left: out.left || out.row1,
            right: out.right || out.row2,
        };

        // normaliza caso algum esteja undefined
        if (!textures4.down) textures4.down = out[dirs[0]];
        if (!textures4.left) textures4.left = textures4.down;
        if (!textures4.right) textures4.right = textures4.down;
        if (!textures4.up) textures4.up = textures4.down;

        return {
            textures4,
            meta: { frameW, frameH, framesPerRow, rows }
        };
    }

    _guessFramesPerRow(imgW, frameH) {
        // tenta frames 3..12, escolhe o que dá frameW inteiro e ratio mais plausível
        let best = null;
        for (let frames = 3; frames <= 12; frames++) {
            if (imgW % frames !== 0) continue;
            const frameW = imgW / frames;

            // score: prioriza ratio ~0.75 (48x64) ou ~1.0 (64x64)
            const ratio = frameW / frameH;
            const score = Math.min(Math.abs(ratio - 0.75), Math.abs(ratio - 1.0));

            if (!best || score < best.score) best = { framesPerRow: frames, frameW, score };
        }

        // fallback padrão 8
        if (!best) {
            const framesPerRow = 8;
            const frameW = Math.floor(imgW / framesPerRow);
            return { framesPerRow, frameW };
        }

        return { framesPerRow: best.framesPerRow, frameW: best.frameW };
    }

    _nearestTexture(t) {
        try {
            if (t?.baseTexture && this.PIXI?.SCALE_MODES) t.baseTexture.scaleMode = this.PIXI.SCALE_MODES.NEAREST;
            if (t?.source && this.PIXI?.SCALE_MODES) t.source.scaleMode = this.PIXI.SCALE_MODES.NEAREST;
        } catch { }
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
    // FLOOR (tiles)
    // ============================================================
    async _loadFloorTextureOrFallback() {
        // tenta achar um tile real dentro de /assets/tiles/
        const candidates = [
            "/assets/tiles/floor.png",
            "/assets/tiles/Floor.png",
            "/assets/tiles/ground.png",
            "/assets/tiles/Ground.png",
            "/assets/tiles/tile.png",
            "/assets/tiles/Tile.png",
        ];

        for (const url of candidates) {
            try {
                const img = await this._loadImage(url);
                const tex = this.PIXI.Texture.from(img);
                this._nearestTexture(tex);
                return tex;
            } catch (_) { }
        }

        // fallback procedural
        return this._makeProceduralFloorTileTexture();
    }

    _makeProceduralFloorTileTexture() {
        const c = document.createElement("canvas");
        c.width = 256;
        c.height = 256;
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = false;

        // “madeira escura / casa abandonada”
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

        const tex = this.PIXI.Texture.from(c);
        this._nearestTexture(tex);
        return tex;
    }

    _makeTilingSprite(texture, w, h) {
        const PIXI = this.PIXI;
        // Pixi v7 vs v8 constructor differences
        try {
            return new PIXI.TilingSprite({ texture, width: w, height: h });
        } catch {
            return new PIXI.TilingSprite(texture, w, h);
        }
    }

    // ============================================================
    // HELPERS
    // ============================================================
    _isAnimatedSprite(obj) {
        return !!(obj && obj.textures && typeof obj.gotoAndPlay === "function" && typeof obj.play === "function");
    }

    _setScale(obj, sx, sy) {
        if (!obj || !obj.scale) return;
        if (typeof obj.scale.set === "function") obj.scale.set(sx, sy);
        else { obj.scale.x = sx; obj.scale.y = sy; }
    }

    _setAnchor(obj, ax, ay) {
        if (!obj || !obj.anchor) return;
        if (typeof obj.anchor.set === "function") obj.anchor.set(ax, ay);
        else { obj.anchor.x = ax; obj.anchor.y = ay; }
    }
}
