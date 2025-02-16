class DinnerLadyAI {
    #dinnerLady;
    #game;
    #config;
    #logger;
    #lastUpdateTime = 0;
    #currentBehavior = 'far';
    #currentInterval = 12;

    constructor(game, dinnerLady) {
        this.#dinnerLady = dinnerLady;
        this.#game = game;
        this.#logger = new Logger();
        this.#loadConfig();
    }

    async #loadConfig() {
        try {
            const response = await fetch('config/dinnerLady.ai');
            this.#config = await response.json();
            this.#logger.info('Loaded dinner lady AI config', this.#config);
        } catch (error) {
            this.#logger.error('Failed to load dinner lady AI config', error);
            // Use default values if config fails to load
            this.#config = {
                distances: { veryClose: 5, close: 10, medium: 20, far: 30 },
                updateIntervals: { veryClose: 1, close: 5, medium: 8, far: 12 },
                behavior: {
                    veryClose: { targetType: 'player', updateInterval: 1 },
                    close: { targetType: 'player', updateInterval: 5 },
                    medium: { targetType: 'player', updateInterval: 8 },
                    far: { targetType: 'random', updateInterval: 12, minDistanceFromPlayer: 15 }
                }
            };
        }
    }

    #getRandomPosition() {
        const level = this.#game.getCurrentLevel();
        if (!level || !level.grid) return null;

        const width = level.width;
        const height = level.height;
        const maxAttempts = 50;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const x = Math.floor(Math.random() * width);
            const z = Math.floor(Math.random() * height);

            // Check if position is walkable (grid values are strings)
            if (level.grid[z]?.[x] === "0") {
                // If we're far from player, this is a valid position
                const player = this.#game.getPlayer();
                const playerPos = player.getPosition();
                const distance = this.#calculateDistance(x * 2, z * 2, playerPos.x, playerPos.z);

                if (distance >= this.#config.behavior.far.minDistanceFromPlayer) {
                    return { x: x * 2, z: z * 2 }; // Convert to world coordinates
                }
            }
            attempts++;
        }

        this.#logger.warn('Could not find valid random position');
        return null;
    }

    #calculateDistance(x1, z1, x2, z2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(z2 - z1, 2));
    }

    #determineNewBehavior() {
        const player = this.#game.getPlayer();
        if (!player) return 'far';

        const playerPos = player.getPosition();
        const dinnerLadyPos = this.#dinnerLady.getPosition();
        const distance = this.#calculateDistance(
            dinnerLadyPos.x, dinnerLadyPos.z,
            playerPos.x, playerPos.z
        );

        if (distance <= this.#config.distances.veryClose) return 'veryClose';
        if (distance <= this.#config.distances.close) return 'close';
        if (distance <= this.#config.distances.medium) return 'medium';
        return 'far';
    }

    update(currentTime) {
        if (!this.#config) return; // Wait for config to load

        // Check if it's time to update
        if (currentTime - this.#lastUpdateTime < this.#currentInterval) return;

        // Determine current behavior based on distance to player
        const newBehavior = this.#determineNewBehavior();
        
        // If behavior changed, update interval
        if (newBehavior !== this.#currentBehavior) {
            this.#currentBehavior = newBehavior;
            this.#currentInterval = this.#config.behavior[newBehavior].updateInterval;
            this.#logger.debug('Dinner lady behavior changed', { 
                behavior: newBehavior, 
                interval: this.#currentInterval 
            });
        }

        // Update target based on current behavior
        const behavior = this.#config.behavior[this.#currentBehavior];
        if (behavior.targetType === 'player') {
            const player = this.#game.getPlayer();
            if (player) {
                const playerPos = player.getPosition();
                this.#dinnerLady.moveToPosition(playerPos.x, playerPos.z);
            }
        } else if (behavior.targetType === 'random') {
            const randomPos = this.#getRandomPosition();
            if (randomPos) {
                this.#dinnerLady.moveToPosition(randomPos.x, randomPos.z);
            }
        }

        this.#lastUpdateTime = currentTime;
    }
}
