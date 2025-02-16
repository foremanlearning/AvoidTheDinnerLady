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

    constructor(game) {
        this.#game = game;
        this.#logger = new Logger();
        this.#eventManager = EventManager.getInstance();
        
        // Initialize dinner lady character
        this.#character = new DinnerLadyCharacter();
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
        if (this.#currentPath && this.#currentPath.length > 0 && this.#pathIndex < this.#currentPath.length) {
            this.#isMoving = true;
            const targetPos = this.#currentPath[this.#pathIndex];
            
            // Handle both string and object formats
            let x, z;
            if (typeof targetPos === 'string') {
                [x, z] = targetPos.split(',').map(Number);
            } else if (typeof targetPos === 'object') {
                x = targetPos.x;
                z = targetPos.z;
            } else {
                this.#logger.warn('Invalid target position format', { targetPos });
                this.#isMoving = false;
                this.#currentPath = [];
                this.#pathIndex = 0;
                return;
            }
            
            const currentPos = this.#model.position;
            
            // Calculate direction for character rotation
            const dx = x - currentPos.x;
            const dz = z - currentPos.z;
            if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
                const angle = Math.atan2(dx, dz);
                this.#character.setRotation(angle);
            }
            
            // Move towards target
            const speed = 4; // Slightly slower than player
            const step = speed * deltaTime;
            const distance = Math.sqrt(
                Math.pow(x - currentPos.x, 2) + 
                Math.pow(z - currentPos.z, 2)
            );
            
            if (distance < step) {
                this.#pathIndex++;
                if (this.#pathIndex >= this.#currentPath.length) {
                    this.#isMoving = false;
                    this.#currentPath = [];
                    this.#pathIndex = 0;
                }
            } else {
                const ratio = step / distance;
                currentPos.x += (x - currentPos.x) * ratio;
                currentPos.z += (z - currentPos.z) * ratio;
            }
        } else {
            this.#isMoving = false;
        }
        
        // Update character animation
        this.#character.setMoving(this.#isMoving);
        this.#character.update(deltaTime);
    }

    getPosition() {
        return this.#model.position;
    }

    getModel() {
        return this.#model;
    }
}
