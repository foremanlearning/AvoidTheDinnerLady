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
            // Load level configuration
            const response = await fetch('levels/levelManager.json');
            const config = await response.json();
            
            this.#levels = config.levels;
            this.#settings = config.settings;
            
            // Load saved progress from localStorage
            this.#loadProgress();
            
            // If no progress, unlock first level
            if (this.#playerProgress.unlockedLevels.size === 0) {
                this.#playerProgress.unlockedLevels.add(this.#settings.defaultStartLevel);
            }
            
            this.#logger.info('LevelManager initialized successfully');
            return true;
        } catch (error) {
            this.#logger.error('Failed to initialize LevelManager:', error);
            return false;
        }
    }

    async loadLevel(levelId) {
        try {
            const levelConfig = this.#levels.find(l => l.id === levelId);
            if (!levelConfig) {
                throw new Error(`Level ${levelId} not found`);
            }

            if (!this.#playerProgress.unlockedLevels.has(levelId)) {
                throw new Error(`Level ${levelId} is locked`);
            }

            // Load level data
            const response = await fetch(`levels/${levelConfig.file}`);
            const levelData = await response.json();

            this.#currentLevel = {
                ...levelConfig,
                ...levelData
            };

            this.#playerProgress.currentLevelId = levelId;
            this.#saveProgress();

            this.#logger.info(`Loaded level: ${levelConfig.name}`);
            return this.#currentLevel;
        } catch (error) {
            this.#logger.error('Failed to load level:', error);
            return null;
        }
    }

    getCurrentLevel() {
        return this.#currentLevel;
    }

    getUnlockedLevels() {
        return Array.from(this.#playerProgress.unlockedLevels);
    }

    getAllLevels() {
        return this.#levels.map(level => ({
            ...level,
            unlocked: this.#playerProgress.unlockedLevels.has(level.id),
            highScore: this.#playerProgress.highScores[level.id] || 0
        }));
    }

    async unlockNextLevel() {
        const currentIndex = this.#levels.findIndex(l => l.id === this.#currentLevel.id);
        if (currentIndex < this.#levels.length - 1) {
            const nextLevel = this.#levels[currentIndex + 1];
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
        this.#levels.forEach(level => {
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

    getSettings() {
        return this.#settings;
    }
}
