class MapLoader {
    static #instance = null;
    #logger;
    #currentLevel = 1;
    #totalLevels = 0;
    #currentMap = null;
    #maps = new Map();

    constructor() {
        if (MapLoader.#instance) {
            return MapLoader.#instance;
        }
        this.#logger = new Logger();
        MapLoader.#instance = this;
    }

    static getInstance() {
        if (!MapLoader.#instance) {
            MapLoader.#instance = new MapLoader();
        }
        return MapLoader.#instance;
    }

    async loadMaps() {
        try {
            const response = await fetch('maps/levels.json');
            const levelList = await response.json();
            this.#totalLevels = levelList.levels.length;
            
            // Load all maps
            for (const level of levelList.levels) {
                const mapResponse = await fetch(`maps/${level.file}`);
                const mapData = await mapResponse.json();
                this.#maps.set(level.id, {
                    ...mapData,
                    name: level.name,
                    id: level.id
                });
            }
            
            this.#logger.info(`Loaded ${this.#totalLevels} maps successfully`);
            return true;
        } catch (error) {
            this.#logger.error('Error loading maps:', error);
            return false;
        }
    }

    getCurrentMap() {
        return this.#currentMap;
    }

    getCurrentLevel() {
        return this.#currentLevel;
    }

    getTotalLevels() {
        return this.#totalLevels;
    }

    loadLevel(levelNumber) {
        if (levelNumber < 1 || levelNumber > this.#totalLevels) {
            this.#logger.error(`Invalid level number: ${levelNumber}`);
            return false;
        }

        this.#currentLevel = levelNumber;
        this.#currentMap = this.#maps.get(levelNumber);
        
        if (!this.#currentMap) {
            this.#logger.error(`Map not found for level ${levelNumber}`);
            return false;
        }

        this.#logger.info(`Loaded level ${levelNumber}: ${this.#currentMap.name}`);
        return true;
    }

    nextLevel() {
        if (this.#currentLevel < this.#totalLevels) {
            return this.loadLevel(this.#currentLevel + 1);
        }
        return false;
    }

    previousLevel() {
        if (this.#currentLevel > 1) {
            return this.loadLevel(this.#currentLevel - 1);
        }
        return false;
    }

    // Helper method to parse special tiles
    parseMapTiles() {
        if (!this.#currentMap) return null;

        const specialTiles = {
            start: null,
            exit: null,
            dinnerLady: null,
            hidingSpaces: [],
            civilians: [],
            informants: []
        };

        for (let y = 0; y < this.#currentMap.height; y++) {
            for (let x = 0; x < this.#currentMap.width; x++) {
                const tile = this.#currentMap.grid[y][x];
                
                if (tile === 'S') specialTiles.start = {x, y};
                else if (tile === 'E') specialTiles.exit = {x, y};
                else if (tile === 'D') specialTiles.dinnerLady = {x, y};
                else if (tile === 'H') specialTiles.hidingSpaces.push({x, y});
                else if (tile.startsWith('CS')) {
                    const pathNum = parseInt(tile.split('-')[1]);
                    if (!specialTiles.civilians[pathNum - 1]) {
                        specialTiles.civilians[pathNum - 1] = {start: {x, y}};
                    } else {
                        specialTiles.civilians[pathNum - 1].start = {x, y};
                    }
                }
                else if (tile.startsWith('CE')) {
                    const pathNum = parseInt(tile.split('-')[1]);
                    if (!specialTiles.civilians[pathNum - 1]) {
                        specialTiles.civilians[pathNum - 1] = {end: {x, y}};
                    } else {
                        specialTiles.civilians[pathNum - 1].end = {x, y};
                    }
                }
                else if (tile.startsWith('IS')) {
                    const pathNum = parseInt(tile.split('-')[1]);
                    if (!specialTiles.informants[pathNum - 1]) {
                        specialTiles.informants[pathNum - 1] = {start: {x, y}};
                    } else {
                        specialTiles.informants[pathNum - 1].start = {x, y};
                    }
                }
                else if (tile.startsWith('IE')) {
                    const pathNum = parseInt(tile.split('-')[1]);
                    if (!specialTiles.informants[pathNum - 1]) {
                        specialTiles.informants[pathNum - 1] = {end: {x, y}};
                    } else {
                        specialTiles.informants[pathNum - 1].end = {x, y};
                    }
                }
            }
        }

        return specialTiles;
    }
}
