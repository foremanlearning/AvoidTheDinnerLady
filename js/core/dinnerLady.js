class DinnerLady {
    #model;
    #character;
    #label;
    #logger;
    #eventManager;
    #game;
    #isMoving = false;
    #currentPath = [];
    #pathIndex = 0;
    #config;
    #currentSpeed = 0;

    constructor(game) {
        this.#game = game;
        this.#logger = new Logger();
        
        // Load AI configuration
        this.#loadConfig();
        
        // Initialize character with construction config
        this.#character = new MinecraftCharacter(this.#config?.construction);
        this.#model = this.#character.getModel();
        
        // Create label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'dinner-lady-label';
        labelDiv.textContent = 'Dinner Lady';
        this.#label = new THREE.CSS2DObject(labelDiv);
        this.#label.position.set(0, 2, 0);
        this.#model.add(this.#label);
        
        // Add to scene
        game.getScene().add(this.#model);
    }

    async #loadConfig() {
        try {
            const response = await fetch('config/dinnerLady.ai');
            if (!response.ok) {
                throw new Error('Failed to load dinner lady config');
            }
            this.#config = await response.json();
            this.#logger.info('Loaded dinner lady AI config', this.#config);
        } catch (error) {
            this.#logger.error('Error loading dinner lady config:', error);
            // Use default values if config fails to load
            this.#config = {
                movement: {
                    speed: 4.5,
                    rotationSpeed: 7.0,
                    acceleration: 1.8,
                    deceleration: 3.5
                },
                animation: {
                    walkSpeed: 1.1,
                    runSpeed: 1.8,
                    turnSpeed: 1.3,
                    blendDuration: 0.3
                }
            };
        }
    }

    setPosition(x, z) {
        this.#model.position.set(x, 0, z);
        
        // Update label position
        if (this.#label) {
            this.#label.position.set(0, 2, 0);
        }
    }

    moveToPosition(x, z) {
        const currentPos = this.#model.position;
        const currentLevel = this.#game.getCurrentLevel();
        
        if (!currentLevel) {
            this.#logger.warn('No level loaded');
            return;
        }

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
            this.#currentPath = path;
            this.#pathIndex = 0;
            this.#isMoving = true;
        } else {
            this.#logger.warn('No valid path found to destination', {
                from: { x: currentPos.x, z: currentPos.z },
                to: { x, z }
            });
        }
    }

    update(deltaTime) {
        if (!this.#config) return;

        if (this.#currentPath.length > 0 && this.#pathIndex < this.#currentPath.length) {
            const target = this.#currentPath[this.#pathIndex];
            const position = this.getPosition();
            
            // Calculate direction and distance
            const dx = target.x - position.x;
            const dz = target.z - position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance > 0.1) {
                // Calculate movement based on config
                const speed = this.#config.movement.speed;
                const acceleration = this.#config.movement.acceleration;
                const deceleration = this.#config.movement.deceleration;
                
                // Calculate current speed with smooth acceleration
                let currentSpeed;
                if (this.#isMoving) {
                    currentSpeed = Math.min(speed, this.#currentSpeed + acceleration * deltaTime);
                } else {
                    currentSpeed = Math.min(speed, acceleration * deltaTime);
                }
                this.#currentSpeed = currentSpeed;
                
                // Move towards target
                const moveX = (dx / distance) * currentSpeed * deltaTime;
                const moveZ = (dz / distance) * currentSpeed * deltaTime;
                
                this.#model.position.x += moveX;
                this.#model.position.z += moveZ;
                
                // Rotate towards movement direction
                const targetRotation = Math.atan2(dx, dz);
                const currentRotation = this.#model.rotation.y;
                const rotationDiff = targetRotation - currentRotation;
                
                // Normalize rotation difference
                const normalizedDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));
                
                // Apply rotation with smooth interpolation
                const rotationSpeed = this.#config.movement.rotationSpeed;
                const rotationAmount = Math.sign(normalizedDiff) * Math.min(Math.abs(normalizedDiff), rotationSpeed * deltaTime);
                this.#model.rotation.y += rotationAmount;
                
                // Update character animation with speed-based animation
                if (this.#character) {
                    const animSpeed = distance > 1 ? this.#config.animation.runSpeed : this.#config.animation.walkSpeed;
                    this.#character.setMoving(true, animSpeed);
                }
                
                this.#isMoving = true;
            } else {
                // Apply deceleration when reaching target
                if (this.#currentSpeed > 0) {
                    this.#currentSpeed = Math.max(0, this.#currentSpeed - this.#config.movement.deceleration * deltaTime);
                }
                
                if (this.#currentSpeed === 0) {
                    this.#pathIndex++;
                    if (this.#pathIndex >= this.#currentPath.length) {
                        this.#currentPath = [];
                        this.#pathIndex = 0;
                        this.#isMoving = false;
                        
                        // Stop animation with smooth transition
                        if (this.#character) {
                            this.#character.setMoving(false);
                        }
                    }
                }
            }
        }

        // Update character animations
        if (this.#character) {
            this.#character.update(deltaTime);
        }
    }

    getPosition() {
        return this.#model.position;
    }

    getModel() {
        return this.#model;
    }
}
