// Define GameScene class in the global scope
window.GameScene = class GameScene {
    #game = null;
    #logger = null;
    #scene = null;
    #camera = null;
    #isInputActive = false;
    #lastInputX = 0;
    #lastInputY = 0;
    #inputStartX = 0;
    #inputStartY = 0;
    #inputStartTime = 0;
    #player = null;
    #cameraAngle = 0;
    #cameraRotationSpeed = 0.01;
    #cameraTarget = null;
    #cameraOffset = new THREE.Vector3(0, 10, 10);

    constructor(game) {
        this.#game = game;
        this.#logger = Logger.getInstance();
        this.#scene = game.getScene();
        this.#camera = game.getCamera();
        this.#player = game.getPlayer(); // Try to get player initially
        this.#cameraTarget = this.#player; // Default camera target is player
        this.#setupTouchControls();
        this.#setupKeyboardControls();
    }

    #setupTouchControls() {
        const canvas = this.#game.getRenderer().domElement;
        
        canvas.addEventListener('touchstart', (event) => {
            this.#logger.debug('Touch start event received', {
                touches: event.touches.length,
                x: event.touches[0]?.clientX,
                y: event.touches[0]?.clientY
            });
            this.onTouchStart(event);
        });
        canvas.addEventListener('touchmove', (event) => {
            this.#logger.debug('Touch move event received', {
                touches: event.touches.length,
                x: event.touches[0]?.clientX,
                y: event.touches[0]?.clientY
            });
            this.onTouchMove(event);
        });
        canvas.addEventListener('touchend', (event) => {
            this.#logger.debug('Touch end event received');
            this.onTouchEnd(event);
        });
        canvas.addEventListener('mousedown', (event) => {
            this.#logger.debug('Mouse down event received', {
                x: event.clientX,
                y: event.clientY
            });
            this.onMouseDown(event);
        });
        canvas.addEventListener('mousemove', (event) => this.onMouseMove(event));
        canvas.addEventListener('mouseup', (event) => {
            this.#logger.debug('Mouse up event received', {
                x: event.clientX,
                y: event.clientY
            });
            this.onMouseUp(event);
        });
    }

    #setupKeyboardControls() {
        window.addEventListener('keydown', (event) => {
            // Check for Control + Alt + D
            if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'd') {
                this.#toggleCameraTarget();
            }
        });
    }

    onTouchStart(event) {
        event.preventDefault();
        const touch = event.touches[0];
        if (!touch) return;

        this.#handleInputStart(touch.clientX, touch.clientY);
    }

    onTouchMove(event) {
        event.preventDefault();
        const touch = event.touches[0];
        if (!touch) return;

        this.#handleInputMove(touch.clientX, touch.clientY);
    }

    onTouchEnd(event) {
        event.preventDefault();
        this.#handleInputEnd();
    }

    onMouseDown(event) {
        this.#handleInputStart(event.clientX, event.clientY);
    }

    onMouseMove(event) {
        if (!this.#isInputActive) return;
        this.#handleInputMove(event.clientX, event.clientY);
    }

    onMouseUp(event) {
        this.#handleInputEnd();
    }

    #handleInputStart(x, y) {
        this.#isInputActive = true;
        this.#lastInputX = x;
        this.#lastInputY = y;
        this.#inputStartX = x;
        this.#inputStartY = y;
        this.#inputStartTime = Date.now();
    }

    #handleInputMove(x, y) {
        if (!this.#isInputActive) return;

        const deltaX = x - this.#lastInputX;
        this.#cameraAngle -= deltaX * this.#cameraRotationSpeed;

        this.#lastInputX = x;
        this.#lastInputY = y;
    }

    #handleInputEnd() {
        const currentTime = Date.now();
        const deltaTime = currentTime - this.#inputStartTime;
        
        if (deltaTime < 200) { // Click threshold of 200ms
            const ray = this.#createRayFromScreen(this.#inputStartX, this.#inputStartY);
            if (ray) {
                this.#handleClick(ray);
            }
        }
        
        this.#isInputActive = false;
    }

    #createRayFromScreen(x, y) {
        if (!this.#camera) return null;

        const rect = this.#game.getRenderer().domElement.getBoundingClientRect();
        const mouseX = ((x - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((y - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        const mouseVector = new THREE.Vector2(mouseX, mouseY);
        
        raycaster.setFromCamera(mouseVector, this.#camera);
        return raycaster;
    }

    #handleClick(ray) {
        const intersects = ray.intersectObjects(this.#scene.children, true);
        
        // Find the floor intersection
        const groundIntersect = intersects.find(intersect => {
            // Check if it's the floor mesh by name
            return intersect.object.name === 'floor';
        });

        if (groundIntersect) {
            const point = groundIntersect.point;
            if (this.#player) {
                this.#logger.info('Moving player to clicked position', { x: point.x, z: point.z });
                this.#player.moveToPosition(point.x, point.z);
            } else {
                this.#logger.warn('No player found for movement');
            }
        } else {
            this.#logger.debug('No floor intersection found');
        }
    }

    #toggleCameraTarget() {
        const dinnerLady = this.#game.getDinnerLady();
        if (!dinnerLady) {
            this.#logger.warn('No dinner lady found to focus camera on');
            return;
        }

        // Toggle between player and dinner lady
        if (this.#cameraTarget === this.#player) {
            this.#cameraTarget = dinnerLady;
            this.#logger.info('Camera focused on Dinner Lady');
        } else {
            this.#cameraTarget = this.#player;
            this.#logger.info('Camera focused on Player');
        }
    }

    update(deltaTime) {
        // Update player reference in case it was created after GameScene
        if (!this.#player) {
            this.#player = this.#game.getPlayer();
            if (this.#player) {
                this.#cameraTarget = this.#player;
            }
        }

        // Update camera position based on target
        if (this.#cameraTarget) {
            const targetPos = this.#cameraTarget.getPosition();
            
            // Calculate camera position based on angle and offset
            const cameraX = targetPos.x + Math.sin(this.#cameraAngle) * this.#cameraOffset.z;
            const cameraZ = targetPos.z + Math.cos(this.#cameraAngle) * this.#cameraOffset.z;
            
            // Smoothly interpolate camera position
            this.#camera.position.x += (cameraX - this.#camera.position.x) * 5 * deltaTime;
            this.#camera.position.y = this.#cameraOffset.y;
            this.#camera.position.z += (cameraZ - this.#camera.position.z) * 5 * deltaTime;
            
            // Look at target with slight height offset for better perspective
            this.#camera.lookAt(targetPos.x, 1, targetPos.z);
        }
    }
};
