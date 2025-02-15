class Player {
    #cube;
    #label;
    #stats;
    #currentPath = [];
    #isMoving = false;
    #logger;
    #eventManager;
    #game;
    #uiManager;
    #inventory = [];
    #levelManager;

    constructor(game) {
        this.#game = game;
        this.#logger = Logger.getInstance();
        this.#eventManager = new EventManager();
        this.#uiManager = UIManager.getInstance();
        
        // Create player mesh
        const geometry = new THREE.BoxGeometry(0.8, 1, 0.8);
        const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 }); // Bright green for visibility
        this.#cube = new THREE.Mesh(geometry, material);
        this.#cube.castShadow = true;
        this.#cube.receiveShadow = true;
        this.#cube.name = 'player';
        
        // Create player label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'player-label';
        labelDiv.textContent = 'Player';
        labelDiv.style.color = 'white';
        labelDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        labelDiv.style.padding = '2px 6px';
        labelDiv.style.borderRadius = '3px';
        labelDiv.style.fontSize = '12px';
        this.#label = new THREE.CSS2DObject(labelDiv);
        this.#label.position.set(0, 1.5, 0);
        this.#cube.add(this.#label);

        // Initialize stats
        this.#stats = {
            hp: 100,
            maxHp: 100,
            level: 1,
            xp: 0,
            maxXp: 100,
            floor: 1,
            strength: 10,
            dexterity: 10,
            intelligence: 10,
            constitution: 10
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

    setPosition(x, y) {
        if (this.#cube) {
            this.#cube.position.set(x, 0.5, y);
            this.#logger.info(`Setting player position to (${x}, 0.5, ${y})`);
        }
    }

    #moveAlongPath() {
        if (this.#currentPath.length === 0) {
            this.#isMoving = false;
            return;
        }

        this.#isMoving = true;
        const nextPoint = this.#currentPath[0];
        const targetX = nextPoint.x;
        const targetZ = nextPoint.y;
        
        // Calculate distance to target
        const distance = new THREE.Vector3(targetX, this.#cube.position.y, targetZ)
            .distanceTo(this.#cube.position);
            
        if (distance < 0.1) {
            this.#currentPath.shift();
            if (this.#currentPath.length > 0) {
                requestAnimationFrame(() => this.#moveAlongPath());
            } else {
                this.#isMoving = false;
            }
            return;
        }
        
        // Move towards target with smooth interpolation
        const speed = 0.1;
        this.#cube.position.x += (targetX - this.#cube.position.x) * speed;
        this.#cube.position.z += (targetZ - this.#cube.position.z) * speed;
        
        requestAnimationFrame(() => this.#moveAlongPath());
    }

    moveTo(point) {
        // Reset movement state
        this.#isMoving = false;
        this.#currentPath = [];

        const levelManager = this.#game.getLevelManager();
        const currentLevel = levelManager.getCurrentLevel();
        if (!currentLevel) {
            this.#logger.error('No level data available');
            return;
        }
        
        const grid = currentLevel.grid;
        const gridSize = grid.length;
        
        // Convert world coordinates to grid coordinates
        const gridX = Math.floor(point.x);
        const gridZ = Math.floor(point.z);
        
        // Get current player position in grid coordinates
        const currentGridX = Math.floor(this.#cube.position.x);
        const currentGridZ = Math.floor(this.#cube.position.z);
        
        this.#logger.debug('Moving from', { currentGridX, currentGridZ, to: { gridX, gridZ }});
        
        // Find path using pathfinder
        const pathfinder = Pathfinder.getInstance();
        const path = pathfinder.findPath(grid, currentGridX, currentGridZ, gridX, gridZ);
        
        if (path && path.length > 0) {
            this.#currentPath = path;
            this.#logger.debug('Path found', { path: this.#currentPath });
            this.#isMoving = true;
            this.#moveAlongPath();
        } else {
            this.#logger.warn('No valid path found to destination');
        }
    }

    update() {
        if (!this.#isMoving || this.#currentPath.length === 0) {
            this.#isMoving = false;  // Ensure state is consistent
            return;
        }

        const target = this.#currentPath[0];
        const position = this.#cube.position;
        const moveSpeed = GameConfig.player.moveSpeed;

        // Calculate distance to target
        const distanceToTarget = position.distanceTo(new THREE.Vector3(target.x, target.y, target.z));

        if (distanceToTarget < moveSpeed) {
            // We've reached the current waypoint
            position.set(target.x, target.y, target.z);
            this.#currentPath.shift();
            
            if (this.#currentPath.length === 0) {
                this.#isMoving = false;
                this.#logger.debug('Reached destination');
                this.#checkForInteraction();
            }
        } else {
            // Move towards target
            const direction = new THREE.Vector3()
                .subVectors(new THREE.Vector3(target.x, target.y, target.z), position)
                .normalize();
            
            position.add(direction.multiplyScalar(moveSpeed));
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
        this.#stats.hp = Math.max(0, this.#stats.hp - amount);
        this.#updateUI();
        
        if (this.#stats.hp <= 0) {
            this.#eventManager.emit('playerDeath');
        }
    }

    heal(amount) {
        this.#stats.hp = Math.min(this.#stats.maxHp, this.#stats.hp + amount);
        this.#updateUI();
    }

    gainXP(amount) {
        this.#stats.xp += amount;
        while (this.#stats.xp >= this.#stats.maxXp) {
            this.levelUp();
        }
        this.#updateUI();
    }

    levelUp() {
        this.#stats.level++;
        this.#stats.xp -= this.#stats.maxXp;
        this.#stats.maxXp = Math.floor(this.#stats.maxXp * 1.5);
        this.#stats.maxHp += 10;
        this.#stats.hp = this.#stats.maxHp;
        
        this.#eventManager.emit('showModal', {
            title: 'Level Up!',
            content: `Congratulations! You reached level ${this.#stats.level}!
                     Your maximum HP has increased to ${this.#stats.maxHp}.`,
            buttons: [{
                text: 'Continue',
                action: () => {}
            }]
        });
        
        this.#updateUI();
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
