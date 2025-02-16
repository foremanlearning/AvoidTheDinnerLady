class Game {
    static #instance = null;
    #scene = null;
    #camera = null;
    #renderer = null;
    #labelRenderer = null;
    #player = null;
    #dinnerLady = null;
    #dinnerLadyAI = null;
    #logger = null;
    #levelManager = null;
    #uiManager = null;
    #saveManager = null;
    #gameScene = null;
    #clock = null;
    #isInitialized = false;
    #isGameOver = false;
    #gameOverScreen = null;
    #audioManager = null;
    #dinnerLadyConfig = null;
    #introScreens = null;

    constructor() {
        if (Game.#instance) {
            return Game.#instance;
        }
        Game.#instance = this;
        this.#logger = Logger.getInstance();
        this.#audioManager = AudioManager.getInstance();
    }

    static getInstance() {
        if (!Game.#instance) {
            Game.#instance = new Game();
        }
        return Game.#instance;
    }

    #initializeManagers() {
        try {
            // Try to initialize UI manager if it exists
            if (typeof UIManager !== 'undefined') {
                this.#uiManager = UIManager.getInstance();
            }
        } catch (error) {
            this.#logger.warn('UIManager not available:', error);
        }

        this.#saveManager = SaveManager.getInstance();
        this.#levelManager = LevelManager.getInstance();
        
        // Initialize audio manager
        this.#audioManager.initialize();
        
        return this.#levelManager.initialize();
    }

    async initialize() {
        try {
            this.#logger.info('Initializing game...');
            
            // Create intro screens first
            this.#introScreens = IntroScreens.getInstance(this);
            
            // Load dinner lady config
            try {
                const response = await fetch('config/dinnerLady.ai');
                this.#dinnerLadyConfig = await response.json();
                this.#logger.info('Loaded dinner lady config');
            } catch (error) {
                this.#logger.error('Failed to load dinner lady config:', error);
                throw error;
            }
            
            // Initialize managers
            this.#logger.info('Initializing managers...');
            await this.#initializeManagers();
            
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
            
            // Add audio listener to camera
            this.#camera.add(this.#audioManager.getListener());
            
            this.#camera.position.set(0, 20, 20);
            this.#camera.lookAt(0, 0, 0);
            
            const container = document.getElementById('gameContainer');
            if (!container) {
                throw new Error('Game container not found');
            }
            
            // Initialize renderer
            this.#renderer = new THREE.WebGLRenderer({ antialias: true });
            this.#renderer.setSize(window.innerWidth, window.innerHeight);
            this.#renderer.shadowMap.enabled = true;
            container.appendChild(this.#renderer.domElement);
            
            // Initialize CSS2D renderer
            this.#labelRenderer = new THREE.CSS2DRenderer();
            this.#labelRenderer.setSize(window.innerWidth, window.innerHeight);
            this.#labelRenderer.domElement.style.position = 'absolute';
            this.#labelRenderer.domElement.style.top = '0';
            this.#labelRenderer.domElement.style.pointerEvents = 'none';
            container.appendChild(this.#labelRenderer.domElement);
            
            // Initialize game scene for input handling
            this.#gameScene = new GameScene(this);
            
            // Load default level
            this.#logger.info('Loading default level...');
            const levelData = await this.#levelManager.loadLevel(0);
            if (!levelData) {
                throw new Error('Failed to load default level');
            }

            // Create game objects based on level
            this.#logger.info('Creating game objects...');
            await this.#createGameObjects(levelData, GRID_SCALE);

            // Set up event listeners for input
            this.#setupEventListeners(container);

            this.#isInitialized = true;
            this.#logger.info('Game initialized successfully');
            
            // Don't start animation loop yet - wait for start screen
            return true;
        } catch (error) {
            this.#logger.error('Failed to initialize game:', error);
            throw error;
        }
    }

    start() {
        if (!this.#isInitialized) {
            this.#logger.error('Cannot start game: not initialized');
            return;
        }

        // Start animation loop
        this.#clock = new THREE.Clock();
        this.#animate();
    }

    #setupEventListeners(container) {
        // Touch events
        container.addEventListener('touchstart', this.#onTouchStart.bind(this), false);
        container.addEventListener('touchmove', this.#onTouchMove.bind(this), false);
        container.addEventListener('touchend', this.#onTouchEnd.bind(this), false);

        // Mouse events
        container.addEventListener('mousedown', this.#onMouseDown.bind(this), false);
        container.addEventListener('mousemove', this.#onMouseMove.bind(this), false);
        container.addEventListener('mouseup', this.#onMouseUp.bind(this), false);

        // Window resize
        window.addEventListener('resize', this.#onWindowResize.bind(this));
    }

    #onTouchStart(event) {
        event.preventDefault();
        if (this.#gameScene) {
            this.#gameScene.onTouchStart(event);
        }
    }

    #onTouchMove(event) {
        event.preventDefault();
        if (this.#gameScene) {
            this.#gameScene.onTouchMove(event);
        }
    }

    #onTouchEnd(event) {
        event.preventDefault();
        if (this.#gameScene) {
            this.#gameScene.onTouchEnd(event);
        }
    }

    #onMouseDown(event) {
        if (this.#gameScene) {
            this.#gameScene.onMouseDown(event);
        }
    }

    #onMouseMove(event) {
        if (this.#gameScene) {
            this.#gameScene.onMouseMove(event);
        }
    }

    #onMouseUp(event) {
        if (this.#gameScene) {
            this.#gameScene.onMouseUp(event);
        }
    }

    #animate() {
        requestAnimationFrame(() => this.#animate());
        const deltaTime = this.#clock.getDelta();

        // Skip updates if game is over
        if (this.#isGameOver) return;

        // Update game objects
        if (this.#player) {
            this.#player.update(deltaTime);
        }
        if (this.#dinnerLady) {
            this.#dinnerLady.update(deltaTime);
        }
        if (this.#dinnerLadyAI) {
            this.#dinnerLadyAI.update(this.#clock.getElapsedTime());
        }
        if (this.#gameScene) {
            this.#gameScene.update(deltaTime);
        }

        // Check for collision with dinner lady
        this.#updateDinnerLadyAudio();

        // Render scene
        this.#renderer.render(this.#scene, this.#camera);
        if (this.#labelRenderer) {
            this.#labelRenderer.render(this.#scene, this.#camera);
        }
    }

    #updateDinnerLadyAudio() {
        const player = this.#player;
        const dinnerLady = this.#dinnerLady;
        const audioManager = this.#audioManager;
        
        if (!player || !dinnerLady || !audioManager || !this.#dinnerLadyConfig) return;

        const dx = player.getPosition().x - dinnerLady.getPosition().x;
        const dz = player.getPosition().z - dinnerLady.getPosition().z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        this.#logger.debug(`Distance to dinner lady: ${distance}`);

        // Use ranges from config
        const ranges = this.#dinnerLadyConfig.distances;
        
        // Check ranges from closest to farthest
        if (distance <= ranges.veryClose) {
            audioManager.playRangeSound('veryClose');
            this.#logger.debug('Playing very close range sound');
        } else if (distance <= ranges.close) {
            audioManager.playRangeSound('close');
            this.#logger.debug('Playing close range sound');
        } else if (distance <= ranges.medium) {
            audioManager.playRangeSound('medium');
            this.#logger.debug('Playing medium range sound');
        } else if (distance <= ranges.far) {
            audioManager.playRangeSound('far');
            this.#logger.debug('Playing far range sound');
        }

        // Check for game over condition
        if (distance <= this.#dinnerLadyConfig.captureDistance) {
            this.#handleGameOver();
        }
    }

    #handleGameOver() {
        this.#logger.info('Game Over - Caught by the Dinner Lady!');
        this.#audioManager.playCaptureSound();
        this.#gameOver();
    }

    #gameOver() {
        this.#isGameOver = true;

        // Create game over screen if it doesn't exist
        if (!this.#gameOverScreen) {
            // Create a canvas for the game over text
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 256;
            const context = canvas.getContext('2d');

            // Draw game over message
            context.fillStyle = 'rgba(0, 0, 0, 0.8)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.font = 'bold 48px Arial';
            context.fillStyle = 'red';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('GAME OVER!', canvas.width/2, canvas.height/3);
            context.font = '24px Arial';
            context.fillStyle = 'white';
            context.fillText('Caught by the Dinner Lady!', canvas.width/2, canvas.height/2);
            context.fillText('Press SPACE to try again', canvas.width/2, canvas.height*2/3);

            // Create sprite with the canvas texture
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true,
                depthTest: false
            });
            this.#gameOverScreen = new THREE.Sprite(material);
            this.#gameOverScreen.scale.set(10, 5, 1);

            // Add to scene, positioned in front of camera
            this.#scene.add(this.#gameOverScreen);

            // Add event listener for restart
            window.addEventListener('keydown', (event) => {
                if (event.code === 'Space' && this.#isGameOver) {
                    this.#restartGame();
                }
            });
        }

        // Update game over screen position to face camera
        const updateGameOverScreen = () => {
            if (this.#isGameOver && this.#gameOverScreen) {
                // Position the screen in front of the camera
                const distance = 15;
                const vector = new THREE.Vector3(0, 0, -distance);
                vector.applyQuaternion(this.#camera.quaternion);
                vector.add(this.#camera.position);
                this.#gameOverScreen.position.copy(vector);
                
                // Make it face the camera
                this.#gameOverScreen.quaternion.copy(this.#camera.quaternion);
                
                // Keep updating
                requestAnimationFrame(updateGameOverScreen);
            }
        };
        updateGameOverScreen();
    }

    async #restartGame() {
        this.#logger.info('Restarting game...');
        
        // Reset audio state
        this.#audioManager.resetState();

        // Remove game over screen
        if (this.#gameOverScreen) {
            this.#scene.remove(this.#gameOverScreen);
            this.#gameOverScreen.material.map.dispose();
            this.#gameOverScreen.material.dispose();
            this.#gameOverScreen = null;
        }

        // Reset game state
        this.#isGameOver = false;

        // Clear existing scene
        while(this.#scene.children.length > 0) { 
            const obj = this.#scene.children[0];
            this.#scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(material => material.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        }

        // Reset references
        this.#player = null;
        this.#dinnerLady = null;
        this.#dinnerLadyAI = null;

        try {
            // Reload level from scratch
            this.#logger.info('Reloading level...');
            const levelData = await this.#levelManager.loadLevel(0);
            if (!levelData) {
                throw new Error('Failed to reload level');
            }

            // Recreate game objects with fresh state
            this.#logger.info('Recreating game objects...');
            await this.#createGameObjects(levelData, 2); // GRID_SCALE = 2

            // Reset camera position
            this.#positionCamera(levelData);

            // Update GameScene with new references
            if (this.#gameScene) {
                this.#gameScene.resetState();
            }

            this.#logger.info('Game successfully restarted');
        } catch (error) {
            this.#logger.error('Failed to restart game:', error);
            // Show error message to user
            const errorCanvas = document.createElement('canvas');
            errorCanvas.width = 512;
            errorCanvas.height = 256;
            const context = errorCanvas.getContext('2d');
            
            context.fillStyle = 'rgba(0, 0, 0, 0.8)';
            context.fillRect(0, 0, errorCanvas.width, errorCanvas.height);
            context.font = 'bold 32px Arial';
            context.fillStyle = 'red';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('Error Restarting Game', errorCanvas.width/2, errorCanvas.height/3);
            context.font = '24px Arial';
            context.fillStyle = 'white';
            context.fillText('Please refresh the page', errorCanvas.width/2, errorCanvas.height/2);
            
            const texture = new THREE.CanvasTexture(errorCanvas);
            const material = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true,
                depthTest: false
            });
            const errorScreen = new THREE.Sprite(material);
            errorScreen.scale.set(10, 5, 1);
            this.#scene.add(errorScreen);
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
                        // Create dinner lady at her spawn position
                        const dinnerLadyPos = { x: x * GRID_SCALE, z: row * GRID_SCALE };
                        this.#dinnerLady = new DinnerLady(this);
                        this.#dinnerLady.setPosition(dinnerLadyPos.x, dinnerLadyPos.z);
                        // Initialize dinner lady AI
                        this.#dinnerLadyAI = new DinnerLadyAI(this, this.#dinnerLady);
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

    getLevelGrid() {
        if (this.#levelManager) {
            const currentLevel = this.#levelManager.getCurrentLevel();
            if (currentLevel && currentLevel.grid) {
                return currentLevel.grid;
            }
        }
        this.#logger.warn('No level grid available');
        return null;
    }

    getCurrentLevel() {
        if (!this.#levelManager) {
            this.#logger.warn('Level manager not initialized');
            return null;
        }
        return this.#levelManager.getCurrentLevel();
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
    getRenderer() { return this.#renderer; }
    getLabelRenderer() { return this.#labelRenderer; }
    getPlayer() { return this.#player; }
    getLevelManager() { return this.#levelManager; }
    getUIManager() { return this.#uiManager; }
    getSaveManager() { return this.#saveManager; }
    getGameScene() { return this.#gameScene; }
    getDinnerLady() { return this.#dinnerLady; }
    getAudioManager() { return this.#audioManager; }

    isInitialized() {
        return this.#isInitialized;
    }
}
