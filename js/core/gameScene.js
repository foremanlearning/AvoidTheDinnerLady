class GameScene {
    #logger;
    #eventManager;
    #game;
    #scene;
    #camera;
    #cameraOffset;
    #cameraLookOffset;
    #cameraLerpFactor;
    #isDragging = false;
    #previousTouchX = 0;
    #cameraAngle = 0;
    #dragStart = false;

    constructor(game) {
        this.#game = game;
        this.#logger = Logger.getInstance();
        this.#eventManager = new EventManager();
        
        // Get existing scene from game
        this.#scene = game.getScene();
        this.#camera = game.getCamera();
        
        // Camera settings
        this.#cameraOffset = new THREE.Vector3(0, 10, 15); // Increased height and distance
        this.#cameraLookOffset = new THREE.Vector3(0, 0, -4); // Look ahead of player
        this.#cameraLerpFactor = 0.1; // Smooth camera movement
        
        this.#initialize();
    }
    
    #initialize() {
        this.#setupEventListeners();
        this.#setupTouchControls();
    }

    #setupTouchControls() {
        const canvas = this.#game.getRenderer().domElement;
        let touchStartX = 0;
        let touchStartY = 0;
        
        // Touch Events
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            this.#previousTouchX = touch.clientX;
            this.#isDragging = false;
            this.#dragStart = false;
            this.#logger.debug('Touch start', { x: touchStartX, y: touchStartY });
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const deltaX = touch.clientX - this.#previousTouchX;
            
            // Check if we've moved enough to consider it a drag
            const totalMoveX = Math.abs(touch.clientX - touchStartX);
            const totalMoveY = Math.abs(touch.clientY - touchStartY);
            
            if (totalMoveX > 5 || totalMoveY > 5) {
                this.#dragStart = true;
                this.#logger.debug('Drag started');
            }
            
            // Only handle camera rotation if dragging
            if (this.#dragStart) {
                this.#previousTouchX = touch.clientX;
                this.#cameraAngle += deltaX * 0.01;
                this.#updateCameraPosition();
            }
        });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            this.#logger.debug('Touch end', { dragStart: this.#dragStart });
            
            // Only handle movement if we never started dragging
            if (!this.#dragStart) {
                this.#logger.debug('Attempting movement');
                const raycaster = new THREE.Raycaster();
                const rect = canvas.getBoundingClientRect();
                
                const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
                const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
                
                const mouse = new THREE.Vector2(x, y);
                raycaster.setFromCamera(mouse, this.#camera);
                
                // Make sure we're checking all objects in the scene
                const dungeon = this.#scene.getObjectByName('dungeon');
                if (dungeon) {
                    const intersects = raycaster.intersectObject(dungeon, true);
                    this.#logger.debug('Raycast results', { intersects: intersects.length });
                    
                    if (intersects.length > 0) {
                        const point = intersects[0].point;
                        const player = this.#game.getPlayer();
                        this.#logger.debug('Moving to point', { point });
                        if (player) {
                            player.moveTo(point);
                        }
                    }
                }
            }
            
            this.#isDragging = false;
            this.#dragStart = false;
        });

        // Mouse Events - same logic as touch but with mouse events
        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            touchStartX = e.clientX;
            touchStartY = e.clientY;
            this.#previousTouchX = e.clientX;
            this.#isDragging = false;
            this.#dragStart = false;
            this.#logger.debug('Mouse down', { x: touchStartX, y: touchStartY });
        });

        canvas.addEventListener('mousemove', (e) => {
            e.preventDefault();
            const deltaX = e.clientX - this.#previousTouchX;
            
            const totalMoveX = Math.abs(e.clientX - touchStartX);
            const totalMoveY = Math.abs(e.clientY - touchStartY);
            
            if (totalMoveX > 5 || totalMoveY > 5) {
                this.#dragStart = true;
                this.#logger.debug('Mouse drag started');
            }
            
            if (this.#dragStart) {
                this.#previousTouchX = e.clientX;
                this.#cameraAngle += deltaX * 0.01;
                this.#updateCameraPosition();
            }
        });

        canvas.addEventListener('mouseup', (e) => {
            e.preventDefault();
            this.#logger.debug('Mouse up', { dragStart: this.#dragStart });
            
            if (!this.#dragStart) {
                this.#logger.debug('Attempting mouse movement');
                const raycaster = new THREE.Raycaster();
                const rect = canvas.getBoundingClientRect();
                
                const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                
                const mouse = new THREE.Vector2(x, y);
                raycaster.setFromCamera(mouse, this.#camera);
                
                const dungeon = this.#scene.getObjectByName('dungeon');
                if (dungeon) {
                    const intersects = raycaster.intersectObject(dungeon, true);
                    this.#logger.debug('Mouse raycast results', { intersects: intersects.length });
                    
                    if (intersects.length > 0) {
                        const point = intersects[0].point;
                        const player = this.#game.getPlayer();
                        this.#logger.debug('Moving to point', { point });
                        if (player) {
                            player.moveTo(point);
                        }
                    }
                }
            }
            
            this.#isDragging = false;
            this.#dragStart = false;
        });
    }

    #updateCameraPosition() {
        if (!this.#game.getPlayer()) {
            this.#logger.warn('Cannot update camera: player not found');
            return;
        }
        
        const playerPos = this.#game.getPlayer().getPosition();
        if (!playerPos) {
            this.#logger.warn('Cannot update camera: invalid player position');
            return;
        }

        try {
            const radius = Math.sqrt(this.#cameraOffset.x * this.#cameraOffset.x + this.#cameraOffset.z * this.#cameraOffset.z);
            const targetCameraPos = new THREE.Vector3(
                playerPos.x + radius * Math.sin(this.#cameraAngle),
                playerPos.y + this.#cameraOffset.y,
                playerPos.z + radius * Math.cos(this.#cameraAngle)
            );
            
            this.#camera.position.lerp(targetCameraPos, this.#cameraLerpFactor);
            
            const lookTarget = new THREE.Vector3(
                playerPos.x,
                playerPos.y + this.#cameraLookOffset.y,
                playerPos.z
            );
            
            this.#camera.lookAt(lookTarget);
        } catch (error) {
            this.#logger.error('Error updating camera position:', error);
        }
    }

    #setupEventListeners() {
        this.#eventManager.subscribe('playerDeath', () => {
            this.#handlePlayerDeath();
        });
        this.#eventManager.subscribe('levelComplete', () => {
            this.#handleLevelComplete();
        });
    }
    
    update() {
        this.#updateCameraPosition();
    }

    #handlePlayerDeath() {
        const uiManager = UIManager.getInstance();
        uiManager.showModal({
            title: 'Game Over',
            content: 'You have been defeated!',
            buttons: [{
                text: 'Try Again',
                action: () => {
                    this.#game.newGame();
                }
            }]
        });
    }
    
    #handleLevelComplete() {
        const uiManager = UIManager.getInstance();
        uiManager.showModal({
            title: 'Level Complete!',
            content: 'You have completed this level!',
            buttons: [{
                text: 'Next Level',
                action: () => {
                    this.#game.nextLevel();
                }
            }]
        });
    }
}
