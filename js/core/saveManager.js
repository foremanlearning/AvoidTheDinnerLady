class SaveManager {
    static #instance = null;
    #logger;
    #game;
    #saveKey = 'cube-a-lot-save';

    constructor() {
        if (SaveManager.#instance) {
            return SaveManager.#instance;
        }
        this.#logger = new Logger();
        this.#game = Game.getInstance();
        SaveManager.#instance = this;
    }

    static getInstance() {
        if (!SaveManager.#instance) {
            SaveManager.#instance = new SaveManager();
        }
        return SaveManager.#instance;
    }

    saveGame() {
        try {
            const player = this.#game.getPlayer();
            const levelManager = this.#game.getLevelManager();

            const saveData = {
                version: '1.0',
                timestamp: Date.now(),
                player: {
                    stats: player.getStats(),
                    inventory: player.getInventory(),
                    position: {
                        x: player.getPosition().x,
                        y: player.getPosition().y,
                        z: player.getPosition().z
                    }
                },
                level: {
                    currentLevelId: levelManager.getCurrentLevelId(),
                    unlockedLevels: levelManager.getUnlockedLevels()
                }
            };

            localStorage.setItem(this.#saveKey, JSON.stringify(saveData));
            this.#logger.info('Game saved successfully');

            return true;
        } catch (error) {
            this.#logger.error('Failed to save game:', error);
            return false;
        }
    }

    loadGame() {
        try {
            const saveData = localStorage.getItem(this.#saveKey);
            if (!saveData) {
                this.#logger.warn('No save data found');
                return false;
            }

            const data = JSON.parse(saveData);
            
            // Version check
            if (data.version !== '1.0') {
                this.#logger.warn('Save data version mismatch');
                return false;
            }

            // Load player data
            const player = this.#game.getPlayer();
            player.setStats(data.player.stats);
            player.setInventory(data.player.inventory);
            player.setPosition(
                data.player.position.x,
                data.player.position.y,
                data.player.position.z
            );

            // Load level data
            const levelManager = this.#game.getLevelManager();
            levelManager.setUnlockedLevels(data.level.unlockedLevels);
            levelManager.loadLevel(data.level.currentLevelId);

            this.#logger.info('Game loaded successfully');
            return true;
        } catch (error) {
            this.#logger.error('Failed to load game:', error);
            return false;
        }
    }

    hasSaveData() {
        return localStorage.getItem(this.#saveKey) !== null;
    }

    deleteSaveData() {
        try {
            localStorage.removeItem(this.#saveKey);
            this.#logger.info('Save data deleted');
            return true;
        } catch (error) {
            this.#logger.error('Failed to delete save data:', error);
            return false;
        }
    }

    showSaveLoadUI() {
        const uiManager = UIManager.getInstance();
        const hasSave = this.hasSaveData();

        uiManager.showModal({
            title: 'Game Menu',
            content: `
                <div style="text-align: center;">
                    ${hasSave ? 'Would you like to continue your previous game?' : 'Start a new game?'}
                </div>
            `,
            buttons: [
                ...(hasSave ? [{
                    text: 'Load Game',
                    action: () => {
                        if (this.loadGame()) {
                            this.#game.resume();
                        }
                    }
                }] : []),
                {
                    text: 'New Game',
                    action: () => {
                        if (hasSave) {
                            this.deleteSaveData();
                        }
                        this.#game.newGame();
                    }
                }
            ]
        });
    }
}
