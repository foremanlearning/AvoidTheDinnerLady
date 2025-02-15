const GameConfig = {
    debug: true,
    logLevel: 'info', // debug, info, warn, error
    player: {
        size: { x: 1, y: 1, z: 1 },
        color: 0x0000ff,
        startingStats: {
            hp: 100,
            maxHp: 100,
            level: 1,
            xp: 0,
            xpToNext: 100,
            class: 'Adventurer',
            strength: 10,
            dexterity: 10,
            constitution: 10,
            currentFloor: 1
        },
        moveSpeed: 0.1,
        interactionRange: 2,
        inventory: {
            maxSize: 20
        }
    },
    dungeon: {
        roomSize: {
            min: { x: 8, y: 8 },
            max: { x: 12, y: 12 }
        },
        corridorWidth: 3,
        minRooms: 8,
        maxRooms: 12,
        gridCells: { x: 3, y: 3 },
        centralHub: { size: 14 },
        floorTypes: {
            normal: { color: 0x666666 },
            entrance: { color: 0x00ff00 },
            exit: { color: 0xff0000 }
        }
    },
    ui: {
        fontSize: 16,
        fontColor: "#ffffff",
        modalBackground: "rgba(0,0,0,0.8)",
        panels: {
            stats: {
                position: 'top-left',
                padding: 10
            },
            inventory: {
                position: 'top-right',
                padding: 10
            }
        }
    },
    performance: {
        targetFPS: 60,
        updateInterval: 1000 / 60,
        logThrottleInterval: 1000
    },
    gameplay: {
        xp: {
            levelMultiplier: 1.5,
            baseXP: 100
        },
        combat: {
            baseDamage: 5,
            criticalMultiplier: 2,
            healingPotionAmount: 20
        }
    }
};
