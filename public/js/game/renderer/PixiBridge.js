export function buildRenderState(game) {
    return {
        arena: {
            w: game.arenaW ?? game.worldW ?? game.mapW ?? 2600,
            h: game.arenaH ?? game.worldH ?? game.mapH ?? 1400,
        },
        time: game.time ?? game.elapsed ?? 0,
        player: game.player,
        enemies: game.enemies ?? [],
        boss: game.boss ?? null,
        bullets: game.projectiles ?? game.bullets ?? [],
    };
}

export function buildHudState(game) {
    const p = game.player ?? {};
    return {
        name: p.name ?? "Player",
        level: p.level ?? game.level ?? 1,
        xp: p.xp ?? game.xp ?? 0,
        xpNext: p.xpNext ?? game.xpNext ?? 10,

        hp: p.hp ?? p.health ?? 100,
        maxHp: p.maxHp ?? p.maxHealth ?? 100,

        dmg: p.damage ?? game.damage ?? 10,
        fr: p.fireRate ?? game.fireRate ?? 2.0,
        spd: p.speed ?? game.speed ?? 3.0,

        time: game.time ?? game.elapsed ?? 0,
        enemies: (game.enemies ?? []).length,
        bossAi: !!(game.bossAiEnabled ?? game.bossAiOn),
        bossIn: game.bossSpawnIn ?? game.bossIn ?? null,
    };
}
