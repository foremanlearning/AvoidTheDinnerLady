class Player {
    #cube;
    #label;
    #stats;
    #currentPath = [];
    #pathIndex = 0;
    #isMoving = false;
    #logger;
    #eventManager;
    #game;
    #uiManager;
    #inventory = [];
    #levelManager;
    #character;
    #config;

    constructor(game) {
        this.#game = game;
        this.#logger = new Logger();
        this.#eventManager = EventManager.getInstance();
        this.#uiManager = UIManager.getInstance();
        
        // Load player AI configuration
        this.#loadConfig();
        
        // Initialize player character
        this.#character = new MinecraftCharacter();
        this.#cube = this.#character.getModel();
        
        // Create player label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'player-label';
        labelDiv.textContent = 'Player';
        this.#label = new THREE.CSS2DObject(labelDiv);
        this.#label.position.set(0, 2, 0);
        this.#cube.add(this.#label);

        // Initialize stats
        this.#stats = {
            health: 100,
            stamina: this.#config?.stamina?.max || 100,
            keys: 0,
            score: 0
        };
        
        this.#setupEventListeners();
        this.#updateUI();
    }

    async #loadConfig() {
        try {
            const response = await fetch('config/player.ai');
            if (!response.ok) {
                throw new Error('Failed to load player config');
            }
            this.#config = await response.json();
            this.#logger.info('Loaded player config', this.#config);
        } catch (error) {
            this.#logger.error('Error loading player config:', error);
            // Use default values if config fails to load
            this.#config = {
                movement: { speed: 5.0, rotationSpeed: 8.0 },
                pathfinding: {
                    wallAvoidance: { enabled: true, baseCost: 2.0, maxCost: 5.0 }
                },
                stamina: { max: 100, regenRate: 10.0 }
            };
        }
    }

    #setupEventListeners() {
        // Update event for movement and label position
        this.#eventManager.subscribe('update', () => {
            this.update();
            this.#updateLabelPosition();
        });
    }

    #updateLabelPosition() {
        if (this.#cube && this.#label) {
            const vector = new THREE.Vector3();
            this.#cube.updateMatrixWorld();
            vector.setFromMatrixPosition(this.#cube.matrixWorld);
            vector.y += 2;

            const camera = this.#game.getCamera();
            vector.project(camera);

            const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

            this.#label.element.style.transform = `translate(-50%, -50%)`;
            this.#label.element.style.left = `${x}px`;
            this.#label.element.style.top = `${y}px`;
            this.#label.element.style.display = 'block';
        }
    }

    setPosition(x, z) {
        this.#logger.info(`Setting player position to (${x}, ${z})`);
        
        // Update cube position
        if (this.#cube) {
            this.#cube.position.set(x, 0.5, z);
            
            // Update camera to follow player
            if (this.#game && typeof this.#game.updateCameraPosition === 'function') {
                this.#game.updateCameraPosition(x, z);
            }
        }
        
        // Update label position
        if (this.#label) {
            this.#label.position.set(x, 2, z);
        }
    }

    moveTo(point) {
        this.#logger.debug('Moving to point', { point });
        if (!point || typeof point.x === 'undefined' || typeof point.z === 'undefined') {
            this.#logger.warn('Invalid point provided to moveTo', { point });
            return;
        }
        this.moveToPosition(point.x, point.z);
    }

    moveToPosition(x, z) {
        const currentLevel = this.#game.getCurrentLevel();
        if (!currentLevel || !currentLevel.grid) {
            this.#logger.error('No level grid available for pathfinding');
            return;
        }

        if (typeof x !== 'number' || typeof z !== 'number') {
            this.#logger.warn('Invalid coordinates provided to moveToPosition', { x, z });
            return;
        }

        // Get current position
        const currentPos = this.#cube.position;
        
        this.#logger.debug('Moving player', {
            from: { x: currentPos.x, z: currentPos.z },
            to: { x, z }
        });

        // Convert world coordinates to grid coordinates
        const GRID_SCALE = 2;
        const currentGridX = Math.floor(currentPos.x / GRID_SCALE);
        const currentGridZ = Math.floor(currentPos.z / GRID_SCALE);
        const targetGridX = Math.floor(x / GRID_SCALE);
        const targetGridZ = Math.floor(z / GRID_SCALE);

        this.#logger.debug('Grid coordinates', {
            from: { x: currentGridX, z: currentGridZ },
            to: { x: targetGridX, z: targetGridZ }
        });

        const pathfinder = Pathfinder.getInstance();
        const path = pathfinder.findPath(
            currentLevel.grid,
            currentGridX,
            currentGridZ,
            targetGridX,
            targetGridZ
        );

        if (path) {
            // Convert grid coordinates back to world coordinates
            this.#currentPath = path.map(pos => {
                const gridX = typeof pos === 'string' ? Number(pos.split(',')[0]) : pos.x;
                const gridZ = typeof pos === 'string' ? Number(pos.split(',')[1]) : pos.y;
                return {
                    x: gridX * GRID_SCALE + GRID_SCALE / 2, // Center in the grid cell
                    z: gridZ * GRID_SCALE + GRID_SCALE / 2
                };
            });
            
            this.#pathIndex = 0;
            this.#isMoving = true;
            
            this.#logger.debug('Path found', { 
                path: this.#currentPath,
                startPos: { x: currentPos.x, z: currentPos.z },
                targetPos: { x, z }
            });
        } else {
            this.#logger.warn('No valid path found to destination', {
                from: { x: currentPos.x, z: currentPos.z },
                to: { x, z }
            });
        }
    }

    update(deltaTime) {
        if (!this.#isMoving || !this.#currentPath || this.#pathIndex >= this.#currentPath.length) {
            return;
        }

        const target = this.#currentPath[this.#pathIndex];
        const currentPos = this.#cube.position;
        
        // Calculate movement based on config speed
        const speed = this.#config?.movement?.speed || 5.0;
        const moveSpeed = speed * deltaTime;
        
        const dx = target.x - currentPos.x;
        const dz = target.z - currentPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < moveSpeed) {
            // Reached current waypoint
            this.#pathIndex++;
            if (this.#pathIndex >= this.#currentPath.length) {
                this.#isMoving = false;
                this.#currentPath = null;
                return;
            }
        } else {
            // Move towards target
            const moveX = (dx / distance) * moveSpeed;
            const moveZ = (dz / distance) * moveSpeed;
            
            currentPos.x += moveX;
            currentPos.z += moveZ;

            // Update character rotation
            const angle = Math.atan2(dx, dz);
            const rotationSpeed = this.#config?.movement?.rotationSpeed || 8.0;
            this.#cube.rotation.y = angle;
        }

        // Update stamina
        if (this.#config?.stamina?.enabled) {
            // Drain stamina while moving
            if (this.#isMoving) {
                const staminaCost = this.#config.stamina.drainRate * deltaTime;
                this.#stats.stamina = Math.max(0, this.#stats.stamina - staminaCost);
            } else {
                // Only regenerate stamina when not moving and after delay
                const regenAmount = this.#config.stamina.regenRate * deltaTime;
                this.#stats.stamina = Math.min(this.#config.stamina.max, this.#stats.stamina + regenAmount);
            }
        }

        this.#updateUI();
    }

    #checkForInteraction() {
        // Check for interactable objects in range
        const raycaster = new THREE.Raycaster();
        const directions = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, -1)
        ];

        for (const direction of directions) {
            raycaster.set(this.#cube.position, direction);
            const intersects = raycaster.intersectObjects(
                this.#game.getScene().getObjectByName('dungeon').children
            );

            if (intersects.length > 0 && intersects[0].distance < 2) {
                const object = intersects[0].object;
                if (object.userData.interactable) {
                    this.#interact(object);
                }
            }
        }
    }

    #interact(object) {
        const interaction = object.userData.interaction;
        if (!interaction) return;

        this.#eventManager.emit('showModal', {
            title: interaction.title || 'Interaction',
            content: interaction.content || '',
            buttons: interaction.buttons || [{
                text: 'Close',
                action: () => {}
            }]
        });
    }

    rollDice(sides = 20) {
        return Math.floor(Math.random() * sides) + 1;
    }

    makeSkillCheck(attribute, difficulty) {
        const roll = this.rollDice();
        const modifier = Math.floor((this.#stats[attribute] - 10) / 2);
        return {
            success: roll + modifier >= difficulty,
            roll,
            total: roll + modifier
        };
    }

    addToInventory(item) {
        const existingItem = this.#inventory.find(i => i.name === item.name);
        if (existingItem) {
            existingItem.quantity += item.quantity || 1;
        } else {
            this.#inventory.push({
                ...item,
                quantity: item.quantity || 1
            });
        }
        this.#uiManager.updateInventory(this.#inventory);
    }

    removeFromInventory(itemName, quantity = 1) {
        const item = this.#inventory.find(i => i.name === itemName);
        if (item) {
            item.quantity -= quantity;
            if (item.quantity <= 0) {
                this.#inventory = this.#inventory.filter(i => i.name !== itemName);
            }
            this.#uiManager.updateInventory(this.#inventory);
        }
    }

    takeDamage(amount) {
        this.#stats.health = Math.max(0, this.#stats.health - amount);
        this.#updateUI();
        
        if (this.#stats.health <= 0) {
            this.#eventManager.emit('playerDeath');
        }
    }

    heal(amount) {
        this.#stats.health = Math.min(100, this.#stats.health + amount);
        this.#updateUI();
    }

    gainXP(amount) {
        this.#stats.score += amount;
        this.#updateUI();
    }

    levelUp() {
        // Not implemented
    }

    #updateUI() {
        this.#eventManager.emit('updateStats', this.#stats);
    }

    getMesh() {
        return this.#cube;
    }

    // Getters
    getPosition() { return this.#cube.position; }
    getStats() { return { ...this.#stats }; }
}
