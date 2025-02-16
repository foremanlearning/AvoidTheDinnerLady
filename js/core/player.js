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

    constructor(game) {
        this.#game = game;
        this.#logger = new Logger();
        this.#eventManager = EventManager.getInstance();
        this.#uiManager = UIManager.getInstance();
        
        // Initialize player mesh
        const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 }); // Green player
        this.#cube = new THREE.Mesh(geometry, material);
        this.#cube.castShadow = true;
        this.#cube.receiveShadow = true;
        
        // Create player label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'player-label';
        labelDiv.textContent = 'Player';
        this.#label = new THREE.CSS2DObject(labelDiv);
        this.#label.position.set(0, 1.5, 0);
        this.#cube.add(this.#label);

        // Initialize stats
        this.#stats = {
            health: 100,
            stamina: 100,
            keys: 0,
            score: 0
        };
        
        this.#setupEventListeners();
        this.#updateUI();
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
            vector.y += 1.5;

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
            this.#label.position.set(x, 1.5, z);
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
        const currentLevel = this.#game.getLevelManager().getCurrentLevel();
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

        const pathfinder = Pathfinder.getInstance();
        const path = pathfinder.findPath(
            currentLevel.grid,
            Math.round(currentPos.x),
            Math.round(currentPos.z),
            Math.round(x),
            Math.round(z),
            2 // Grid scale
        );

        if (path) {
            this.#currentPath = path.map(pos => {
                const [px, pz] = pos.split(',').map(Number);
                return { x: px, z: pz };
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
        if (!deltaTime) {
            return; // Skip update if no deltaTime provided
        }

        if (this.#isMoving && this.#currentPath && this.#pathIndex < this.#currentPath.length) {
            const target = this.#currentPath[this.#pathIndex];
            if (!target) {
                this.#logger.warn('Invalid target in path');
                this.#isMoving = false;
                this.#currentPath = null;
                return;
            }

            const dx = target.x - this.#cube.position.x;
            const dz = target.z - this.#cube.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance < 0.1) { // Close enough to target
                this.#pathIndex++;
                if (this.#pathIndex >= this.#currentPath.length) {
                    this.#isMoving = false;
                    this.#currentPath = null;
                    this.#logger.debug('Reached destination');
                }
            } else {
                // Move towards target
                const speed = 5 * deltaTime; // Units per second
                const moveX = (dx / distance) * speed;
                const moveZ = (dz / distance) * speed;
                
                this.setPosition(
                    this.#cube.position.x + moveX,
                    this.#cube.position.z + moveZ
                );
            }
        }
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
