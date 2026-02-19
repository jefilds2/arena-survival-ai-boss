export const CFG = {
    arenaPadding: 40,

    player: {
        radius: 12,
        speed: 240,
        dashSpeed: 620,
        dashTime: 0.12,
        dashCooldown: 0.9,
        maxHp: 100
    },

    bullet: {
        speed: 560,
        radius: 4,
        ttl: 1.1
    },

    enemies: {
        radius: 12,
        speed: 120,
        hp: 22,
        dmg: 10,
        spawnEvery: 0.65,
        maxAlive: 80
    },

    orbs: { radius: 6, xp: 10 },

    leveling: {
        baseXp: 40,
        growth: 1.22
    },

    boss: {
        spawnAt: 60,         // segundos
        radius: 34,
        speed: 110,
        maxHp: 420,
        contactDmg: 20,

        // cooldowns (segundos)
        dashCd: 2.4,
        ringCd: 2.2,
        summonCd: 4.5,
        shieldCd: 6.0
    },

    ai: {
        enabledByDefault: true,
        thinkInterval: 1.0,    // chama Gemini a cada 1s (não por frame)
        timeoutMs: 900
    }
};
