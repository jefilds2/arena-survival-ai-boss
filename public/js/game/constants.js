// public/js/game/constants.js
export const CFG = {
    arenaPadding: 40,

    // =========================
    // PLAYER (Player.js usa dt)
    // =========================
    player: {
        // unidades por segundo (porque Player.update faz x += vx * speed * dt)
        speed: 240,

        r: 14,
        radius: 14,

        maxHp: 100,
        dmg: 10,
        fireRate: 4.0,        // tiros/segundo
        bulletSpeedMul: 1.0,

        // dash (Player.js usa isso direto)
        dashSpeed: 520,
        dashTime: 0.14,
        dashCooldown: 1.0,
    },

    // =========================
    // BULLET (Bullet.js usa CFG.bullet)
    // =========================
    bullet: {
        speed: 520,
        ttl: 1.25,
        r: 4,
        radius: 4,
    },

    // =========================
    // ENEMIES (Enemy.js usa dt)
    // =========================
    enemies: {
        speed: 90,
        hp: 26,
        r: 16,
        radius: 16,
        dmg: 10,          // dano por segundo (Game.js multiplica por dt)
        maxAlive: 26,
        spawnEvery: 1.1,
    },

    // =========================
    // ORBS
    // =========================
    orbs: {
        xp: 3,
        r: 10,
        radius: 10,
    },

    // =========================
    // BOSS
    // =========================
    boss: {
        spawnAt: 40,

        speed: 110,
        r: 34,
        radius: 34,

        // base HP (vai escalar por stage no Game)
        maxHp: 900,

        contactDmg: 18,
        projectileDmg: 12,

        // cooldowns (Boss.js usa isso)
        dashCd: 3.2,
        ringCd: 2.6,
        summonCd: 6.5,
        shieldCd: 7.5,

        // poderes extras
        shotgunCd: 3.8,
        teleportCd: 6.2,
    },

    // =========================
    // STAGES (dificuldade)
    // =========================
    stages: {
        start: 1,

        // ao passar de Stage (boss derrotado) cura % do HP máximo
        healOnNext: 0.35,

        // crescimento por Stage (k = stage-1)
        enemyHpGrowth: 0.14,
        enemySpeedGrowth: 0.04,
        enemyDmgGrowth: 0.10,

        // spawn mais agressivo por Stage (reduz tempo entre spawns)
        spawnRateGrowth: 0.08,

        // ✅ trava mínimo pra não virar metralhadora de spawn e quebrar FPS
        spawnEveryMin: 0.30,

        // adiciona inimigos vivos por Stage
        maxAliveGrowth: 2,

        // boss mais forte por Stage
        bossHpGrowth: 0.35,
        bossDmgGrowth: 0.12,

        // boss aparece mais cedo em stages altos
        bossSpawnAtDecay: 2.0,
        bossSpawnAtMin: 18,

        // unlock de poderes por Stage
        powerUnlocks: [
            { level: 1, powers: ["DASH", "SHOOT_RING"] },
            { level: 2, powers: ["SHIELD"] },
            { level: 3, powers: ["SUMMON"] },
            { level: 4, powers: ["SHOTGUN"] },
            { level: 5, powers: ["TELEPORT"] },
        ],
    },

    // =========================
    // LEVELING (XP)
    // =========================
    leveling: {
        // seus nomes (mantidos)
        startXpNext: 10,
        xpGrowth: 1.32,

        // ✅ aliases (pra HUD/Player genéricos não quebrarem)
        baseXp: 10,
        growth: 1.32,
    },

    // =========================
    // IA (Gemini)
    // =========================
    ai: {
        enabled: true,

        // seu nome (mantido)
        thinkEvery: 0.35,

        // ✅ alias (pra compat com implementações que usam thinkInterval)
        thinkInterval: 0.35,

        timeoutMs: 850,
    },
};

// -----------------------------
// aliases / compat (Bullet.js antigo/novo)
// -----------------------------
CFG.bullet = CFG.bullet ?? CFG.bullets ?? CFG.projectile;
CFG.bullets = CFG.bullets ?? CFG.bullet;
CFG.projectile = CFG.projectile ?? CFG.bullet;

// -----------------------------
// aliases de radius (evita quebrar colisão/render)
// -----------------------------
CFG.player.r = CFG.player.r ?? CFG.player.radius;
CFG.enemies.r = CFG.enemies.r ?? CFG.enemies.radius;
CFG.orbs.r = CFG.orbs.r ?? CFG.orbs.radius;
CFG.boss.r = CFG.boss.r ?? CFG.boss.radius;
CFG.bullet.r = CFG.bullet.r ?? CFG.bullet.radius;
