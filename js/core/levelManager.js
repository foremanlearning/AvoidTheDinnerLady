class LevelManager {
    static #instance = null;
    #logger;
    #currentLevel = null;
    #levels = [];
    #settings = {};
    #game;
    #playerProgress = {
        currentLevelId: null,
        unlockedLevels: new Set(),
        highScores: {},
        totalScore: 0
    };

    constructor() {
        if (LevelManager.#instance) {
            return LevelManager.#instance;
        }
        this.#logger = new Logger();
        this.#game = Game.getInstance();
        LevelManager.#instance = this;
    }

    static getInstance() {
        if (!LevelManager.#instance) {
            LevelManager.#instance = new LevelManager();
        }
        return LevelManager.#instance;
    }

    async initialize() {
        try {
            this.#logger.info('Initializing level manager...');
            
            // Load level settings
            const response = await fetch('levels/levelManager.json');
            if (!response.ok) {
                throw new Error('Failed to load level settings');
            }

            this.#settings = await response.json();
            if (!this.#validateSettings(this.#settings)) {
                throw new Error('Invalid level settings format');
            }

            // Load saved progress from localStorage
            this.#loadProgress();
            
            // If no progress, unlock first level
            if (this.#playerProgress.unlockedLevels.size === 0) {
                this.#playerProgress.unlockedLevels.add(this.#settings.defaultStartLevel);
            }
            
            this.#logger.info('LevelManager initialized successfully');
            return true;
        } catch (error) {
            this.#logger.error('Failed to initialize level manager:', error);
            throw error;
        }
    }

    async loadLevel(levelId) {
        try {
            this.#logger.debug('Loading level', { levelId });
            
            // If levelId is a number, convert it to the tutorial level ID for level 0
            if (typeof levelId === 'number' && levelId === 0) {
                levelId = 'tutorial';
            }

            // Get level info from settings
            const levelInfo = this.#settings.levels.find(level => level.id === levelId);
            if (!levelInfo) {
                throw new Error(`Level ${levelId} not found in settings`);
            }

            // Load level data from file
            const levelPath = `levels/${levelInfo.file}`;
            this.#logger.debug('Loading level from path', { levelPath });
            
            const response = await fetch(levelPath);
            if (!response.ok) {
                throw new Error(`Failed to load level file: ${levelPath}`);
            }

            const levelData = await response.json();
            if (!this.#validateLevelData(levelData)) {
                throw new Error('Invalid level data format');
            }

            this.#currentLevel = {
                ...levelInfo,
                ...levelData
            };

            this.#logger.info('Level loaded successfully', { levelId });
            return this.#currentLevel;
        } catch (error) {
            this.#logger.error('Failed to load level:', error);
            throw error;
        }
    }

    #validateLevelData(data) {
        return (
            data &&
            typeof data === 'object' &&
            Array.isArray(data.grid) &&
            typeof data.width === 'number' &&
            typeof data.height === 'number' &&
            data.grid.length > 0 &&
            data.grid[0].length > 0
        );
    }

    getCurrentLevel() {
        return this.#currentLevel;
    }

    getUnlockedLevels() {
        return Array.from(this.#playerProgress.unlockedLevels);
    }

    getAllLevels() {
        return this.#settings.levels.map(level => ({
            ...level,
            unlocked: this.#playerProgress.unlockedLevels.has(level.id),
            highScore: this.#playerProgress.highScores[level.id] || 0
        }));
    }

    async unlockNextLevel() {
        const currentIndex = this.#settings.levels.findIndex(l => l.id === this.#currentLevel.id);
        if (currentIndex < this.#settings.levels.length - 1) {
            const nextLevel = this.#settings.levels[currentIndex + 1];
            this.#playerProgress.unlockedLevels.add(nextLevel.id);
            this.#saveProgress();
            return nextLevel;
        }
        return null;
    }

    updateScore(score) {
        const levelId = this.#currentLevel.id;
        if (score > (this.#playerProgress.highScores[levelId] || 0)) {
            this.#playerProgress.highScores[levelId] = score;
        }
        this.#playerProgress.totalScore += score;
        this.#saveProgress();

        // Check if any levels should be unlocked
        this.#settings.levels.forEach(level => {
            if (!this.#playerProgress.unlockedLevels.has(level.id) && 
                this.#playerProgress.totalScore >= level.requiredScore) {
                this.#playerProgress.unlockedLevels.add(level.id);
            }
        });
    }

    #loadProgress() {
        try {
            const saved = localStorage.getItem('dinnerLady_progress');
            if (saved) {
                const progress = JSON.parse(saved);
                this.#playerProgress = {
                    ...progress,
                    unlockedLevels: new Set(progress.unlockedLevels)
                };
            }
        } catch (error) {
            this.#logger.error('Failed to load progress:', error);
        }
    }

    #saveProgress() {
        try {
            const progress = {
                ...this.#playerProgress,
                unlockedLevels: Array.from(this.#playerProgress.unlockedLevels)
            };
            localStorage.setItem('dinnerLady_progress', JSON.stringify(progress));
        } catch (error) {
            this.#logger.error('Failed to save progress:', error);
        }
    }

    #validateSettings(settings) {
        return (
            settings &&
            typeof settings === 'object' &&
            Array.isArray(settings.levels) &&
            settings.levels.length > 0 &&
            settings.levels.every(level =>
                level.id &&
                level.name &&
                level.file &&
                typeof level.difficulty === 'number' &&
                typeof level.unlocked === 'boolean' &&
                typeof level.requiredScore === 'number'
            )
        );
    }

    getSettings() {
        return this.#settings;
    }
}
