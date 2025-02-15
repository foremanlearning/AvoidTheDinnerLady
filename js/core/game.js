class Game {
    static #instance = null;
    #scene;
    #camera;
    #renderer;
    #labelRenderer;
    #logger;
    #eventManager;
    #isInitialized = false;
    #player;
    #gameScene;
    #levelManager;
    #uiManager;
    #saveManager;

    constructor() {
        if (Game.#instance) {
            return Game.#instance;
        }
        this.#logger = new Logger();
        this.#eventManager = new EventManager();
        Game.#instance = this;
    }

    static getInstance() {
        if (!Game.#instance) {
            Game.#instance = new Game();
        }
        return Game.#instance;
    }

    async initialize() {
        if (this.#isInitialized) {
            this.#logger.warn('Game already initialized');
            return;
        }

        this.#logger.info('Initializing game...');

        try {
            // Initialize managers
            this.#logger.info('Initializing managers...');
            this.#uiManager = UIManager.getInstance();
            this.#saveManager = SaveManager.getInstance();
            this.#levelManager = LevelManager.getInstance();

            // Initialize level manager
            this.#logger.info('Initializing level manager...');
            await this.#levelManager.initialize();

            // Initialize Three.js components
            this.#logger.info('Setting up Three.js scene...');
            this.#scene = new THREE.Scene();
            this.#scene.background = new THREE.Color(0x87CEEB); // Sky blue background
            
            // Set grid scale to 2 (doubles physical size)
            const GRID_SCALE = 2;
            
            // Update camera for larger map
            this.#camera = new THREE.PerspectiveCamera(
                75,
                window.innerWidth / window.innerHeight,
                0.1,
                1000
            );
            this.#camera.position.set(0, 20, 20);
            this.#camera.lookAt(0, 0, 0);
            
            const container = document.getElementById('gameContainer');
            if (!container) {
                throw new Error('Game container not found');
            }

            // Set up WebGL renderer
            this.#renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                alpha: true
            });
            this.#renderer.setSize(window.innerWidth, window.innerHeight);
            this.#renderer.shadowMap.enabled = true;
            this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            container.appendChild(this.#renderer.domElement);

            // Set up CSS2D renderer for labels
            this.#labelRenderer = new THREE.CSS2DRenderer();
            this.#labelRenderer.setSize(window.innerWidth, window.innerHeight);
            this.#labelRenderer.domElement.style.position = 'absolute';
            this.#labelRenderer.domElement.style.top = '0';
            this.#labelRenderer.domElement.style.pointerEvents = 'none';
            container.appendChild(this.#labelRenderer.domElement);

            // Initialize game scene
            this.#logger.info('Initializing game scene...');
            this.#gameScene = new GameScene(this);
            
            // Load default level
            this.#logger.info('Loading default level...');
            const settings = this.#levelManager.getSettings();
            this.#logger.info('Default level:', settings.defaultStartLevel);
            const levelData = await this.#levelManager.loadLevel(settings.defaultStartLevel);
            if (!levelData) {
                throw new Error('Failed to load default level');
            }

            // Create game objects based on level
            this.#logger.info('Creating game objects...');
            await this.#createGameObjects(levelData, GRID_SCALE);

            window.addEventListener('resize', this.#onWindowResize.bind(this));
            
            this.#isInitialized = true;
            this.#logger.info('Game initialized successfully');
            
            // Start game loop
            this.#animate();
        } catch (error) {
            this.#logger.error('Failed to initialize game:', error);
            throw error;
        }
    }

    #positionCamera(levelData) {
        // Calculate the center of the level
        const centerX = levelData.width / 2;
        const centerZ = levelData.height / 2;

        // Initial camera position
        this.#camera.position.set(
            centerX + 5, // Offset to the right
            8,          // Height
            centerZ + 8 // Behind center
        );
        this.#camera.lookAt(new THREE.Vector3(centerX, 0, centerZ));
    }

    #createGameObjects(levelData, GRID_SCALE) {
        this.#logger.info('Starting to create game objects...');
        
        // Clear existing objects
        while(this.#scene.children.length > 0) { 
            this.#scene.remove(this.#scene.children[0]); 
        }
        this.#logger.info('Cleared existing objects');

        // Create dungeon container
        const dungeon = new THREE.Group();
        dungeon.name = 'dungeon';
        this.#scene.add(dungeon);

        // Create walls and floor
        const grid = levelData.grid;
        this.#logger.info(`Creating level grid ${levelData.width}x${levelData.height}`);
        
        let wallCount = 0;
        
        // Create floor plane for entire level
        const floorGeometry = new THREE.PlaneGeometry(levelData.width * GRID_SCALE, levelData.height * GRID_SCALE);
        const floorMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x808080, // Gray floor
            side: THREE.DoubleSide
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = Math.PI / 2;
        floor.position.set(levelData.width * GRID_SCALE / 2 - GRID_SCALE / 2, 0, levelData.height * GRID_SCALE / 2 - GRID_SCALE / 2);
        floor.receiveShadow = true;
        floor.name = 'floor';
        dungeon.add(floor);
        
        // Create walls container
        const walls = new THREE.Group();
        walls.name = 'walls';
        dungeon.add(walls);
        
        // Process grid cells
        for (let row = 0; row < levelData.height; row++) {
            const col = grid[row];
            for (let x = 0; x < levelData.width; x++) {
                const tile = col[x];
                
                // Scale positions by GRID_SCALE
                const xScaled = x * GRID_SCALE;
                const zScaled = row * GRID_SCALE;
                
                // Add objects based on tile type
                if (tile === '1') {
                    // Check adjacent walls to determine wall shape
                    const hasNorth = zScaled > 0 && grid[zScaled/GRID_SCALE-1][xScaled/GRID_SCALE] === '1';
                    const hasSouth = zScaled < levelData.height * GRID_SCALE - GRID_SCALE && grid[zScaled/GRID_SCALE+1][xScaled/GRID_SCALE] === '1';
                    const hasEast = xScaled < levelData.width * GRID_SCALE - GRID_SCALE && grid[zScaled/GRID_SCALE][xScaled/GRID_SCALE+1] === '1';
                    const hasWest = xScaled > 0 && grid[zScaled/GRID_SCALE][xScaled/GRID_SCALE-1] === '1';

                    // Check if this is an edge wall
                    const isNorthEdge = zScaled === 0;
                    const isSouthEdge = zScaled === levelData.height * GRID_SCALE - GRID_SCALE;
                    const isEastEdge = xScaled === levelData.width * GRID_SCALE - GRID_SCALE;
                    const isWestEdge = xScaled === 0;

                    // Count connections
                    const connectionCount = (hasNorth ? 1 : 0) + (hasSouth ? 1 : 0) + 
                                         (hasEast ? 1 : 0) + (hasWest ? 1 : 0);

                    // Create wall group for this position
                    const wallGroup = new THREE.Group();
                    wallGroup.position.set(xScaled, 1, zScaled);
                    wallGroup.name = `wall_${xScaled}_${zScaled}`;

                    const wallMaterial = new THREE.MeshPhongMaterial({ color: 0x4a4a4a });
                    const WALL_THICKNESS = 0.25; // Thinner walls

                    // Handle different wall configurations
                    if (connectionCount === 1 || (connectionCount === 0 && (isNorthEdge || isSouthEdge || isEastEdge || isWestEdge))) {
                        // Straight piece or edge piece
                        let wallGeometry;
                        if (hasNorth || hasSouth || isNorthEdge || isSouthEdge) {
                            wallGeometry = new THREE.BoxGeometry(WALL_THICKNESS, 2, GRID_SCALE + 0.01);
                        } else {
                            wallGeometry = new THREE.BoxGeometry(GRID_SCALE + 0.01, 2, WALL_THICKNESS);
                        }
                        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                        wall.castShadow = true;
                        wall.receiveShadow = true;
                        wallGroup.add(wall);
                    } 
                    else if (connectionCount === 2) {
                        if ((hasNorth && hasSouth) || (hasEast && hasWest)) {
                            const wallGeometry = (hasNorth && hasSouth) ? 
                                new THREE.BoxGeometry(WALL_THICKNESS, 2, GRID_SCALE + 0.01) :
                                new THREE.BoxGeometry(GRID_SCALE + 0.01, 2, WALL_THICKNESS);
                            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                            wall.castShadow = true;
                            wall.receiveShadow = true;
                            wallGroup.add(wall);
                        } else {
                            // L-shape piece
                            const vertical = new THREE.Mesh(
                                new THREE.BoxGeometry(WALL_THICKNESS, 2, GRID_SCALE * 0.75),
                                wallMaterial
                            );
                            const horizontal = new THREE.Mesh(
                                new THREE.BoxGeometry(GRID_SCALE * 0.75, 2, WALL_THICKNESS),
                                wallMaterial
                            );

                            if (hasNorth && hasEast) {
                                vertical.position.set(0, 0, -GRID_SCALE * 0.25);
                                horizontal.position.set(GRID_SCALE * 0.25, 0, 0);
                            } else if (hasNorth && hasWest) {
                                vertical.position.set(0, 0, -GRID_SCALE * 0.25);
                                horizontal.position.set(-GRID_SCALE * 0.25, 0, 0);
                            } else if (hasSouth && hasEast) {
                                vertical.position.set(0, 0, GRID_SCALE * 0.25);
                                horizontal.position.set(GRID_SCALE * 0.25, 0, 0);
                            } else if (hasSouth && hasWest) {
                                vertical.position.set(0, 0, GRID_SCALE * 0.25);
                                horizontal.position.set(-GRID_SCALE * 0.25, 0, 0);
                            }

                            vertical.castShadow = true;
                            vertical.receiveShadow = true;
                            horizontal.castShadow = true;
                            horizontal.receiveShadow = true;
                            wallGroup.add(vertical);
                            wallGroup.add(horizontal);
                        }
                    }
                    else if (connectionCount === 3) {
                        // T-shape piece - extend the pieces slightly longer for clean connections
                        const vertical = new THREE.Mesh(
                            new THREE.BoxGeometry(WALL_THICKNESS, 2, GRID_SCALE + 0.01),
                            wallMaterial
                        );
                        const horizontal = new THREE.Mesh(
                            new THREE.BoxGeometry(GRID_SCALE + 0.01, 2, WALL_THICKNESS),
                            wallMaterial
                        );

                        // Adjust position based on which three sides are connected
                        if (!hasNorth) vertical.position.set(0, 0, GRID_SCALE * 0.25);
                        else if (!hasSouth) vertical.position.set(0, 0, -GRID_SCALE * 0.25);
                        if (!hasEast) horizontal.position.set(-GRID_SCALE * 0.25, 0, 0);
                        else if (!hasWest) horizontal.position.set(GRID_SCALE * 0.25, 0, 0);

                        vertical.castShadow = true;
                        vertical.receiveShadow = true;
                        horizontal.castShadow = true;
                        horizontal.receiveShadow = true;
                        wallGroup.add(vertical);
                        wallGroup.add(horizontal);
                    }
                    else if (connectionCount === 0 && !isNorthEdge && !isSouthEdge && !isEastEdge && !isWestEdge) {
                        // Single post for truly isolated walls (not on edges)
                        const post = new THREE.Mesh(
                            new THREE.BoxGeometry(WALL_THICKNESS, 2, WALL_THICKNESS),
                            wallMaterial
                        );
                        post.castShadow = true;
                        post.receiveShadow = true;
                        wallGroup.add(post);
                    }

                    walls.add(wallGroup);
                    wallCount++;
                }

                // Handle special tiles
                switch(tile) {
                    case 'S':
                        this.#logger.info(`Found start position at (${x}, ${row})`);
                        this.#logger.info('Initializing player...');
                        if (!this.#player) {
                            this.#player = new Player(this);
                            this.#scene.add(this.#player.getMesh()); // Add player mesh to scene
                        }
                        this.#logger.info('Player initialized');
                        this.#logger.info(`Setting player position to (${x * GRID_SCALE}, 0.5, ${row * GRID_SCALE})`);
                        this.#player.setPosition(x * GRID_SCALE, row * GRID_SCALE);
                        break;
                    case 'D':
                        this.#logger.info(`Found dinner lady position at (${x}, ${row})`);
                        // TODO: Create dinner lady
                        break;
                    case 'H':
                        this.#logger.info(`Found hiding spot at (${x}, ${row})`);
                        // Create hiding spot visual indicator
                        const hideSpotGeometry = new THREE.PlaneGeometry(0.8 * GRID_SCALE, 0.8 * GRID_SCALE);
                        const hideSpotMaterial = new THREE.MeshPhongMaterial({ 
                            color: 0x87CEEB,
                            transparent: true,
                            opacity: 0.5,
                            side: THREE.DoubleSide
                        });
                        const hideSpot = new THREE.Mesh(hideSpotGeometry, hideSpotMaterial);
                        hideSpot.rotation.x = Math.PI / 2;
                        hideSpot.position.set(x * GRID_SCALE, 0.01, row * GRID_SCALE);
                        hideSpot.name = `hideSpot_${x}_${row}`;
                        dungeon.add(hideSpot);
                        break;
                }
            }
        }
        
        this.#logger.info(`Created ${wallCount} walls`);
        
        // Set up lighting
        this.#logger.info('Setting up lighting...');
        
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.#scene.add(ambientLight);
        
        // Directional light for shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(levelData.width * GRID_SCALE / 2, 20, levelData.height * GRID_SCALE / 2);
        directionalLight.target.position.set(levelData.width * GRID_SCALE / 2, 0, levelData.height * GRID_SCALE / 2);
        directionalLight.castShadow = true;
        
        // Configure shadow properties
        const shadowSize = Math.max(levelData.width * GRID_SCALE, levelData.height * GRID_SCALE) * 0.6;
        directionalLight.shadow.camera.left = -shadowSize;
        directionalLight.shadow.camera.right = shadowSize;
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.top = shadowSize;
        directionalLight.shadow.camera.bottom = -shadowSize;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        
        this.#scene.add(directionalLight);
        this.#scene.add(directionalLight.target);
        
        this.#logger.info('Finished creating game objects');
    }

    async loadLevel(levelId) {
        const levelData = await this.#levelManager.loadLevel(levelId);
        if (levelData) {
            await this.#createGameObjects(levelData, 2);
            return true;
        }
        return false;
    }

    async nextLevel() {
        const nextLevel = await this.#levelManager.unlockNextLevel();
        if (nextLevel) {
            return this.loadLevel(nextLevel.id);
        }
        return false;
    }

    #animate() {
        if (!this.#isInitialized) return;

        requestAnimationFrame(() => this.#animate());

        try {
            // Update game state
            if (this.#player) {
                this.#player.update();
            }

            if (this.#gameScene) {
                this.#gameScene.update();
            }

            // Render the scene
            this.#renderer.render(this.#scene, this.#camera);
            if (this.#labelRenderer) {
                this.#labelRenderer.render(this.#scene, this.#camera);
            }
        } catch (error) {
            this.#logger.error('Error in animation loop:', error);
        }
    }

    #onWindowResize() {
        if (!this.#isInitialized) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        this.#camera.aspect = width / height;
        this.#camera.updateProjectionMatrix();

        this.#renderer.setSize(width, height);
        if (this.#labelRenderer) {
            this.#labelRenderer.setSize(width, height);
        }
    }

    getScene() { return this.#scene; }
    getCamera() { return this.#camera; }
    getLevelManager() { return this.#levelManager; }
    getRenderer() { return this.#renderer; }
    getPlayer() { return this.#player; }
    getUIManager() { return this.#uiManager; }
    getSaveManager() { return this.#saveManager; }
    getGameScene() { return this.#gameScene; }

    resume() {
        this.#logger.info('Resuming game...');
        // Additional resume logic can be added here
    }

    newGame() {
        this.#logger.info('Starting new game...');
        const settings = this.#levelManager.getSettings();
        this.loadLevel(settings.defaultStartLevel);
        // Additional new game logic can be added here
    }
}
