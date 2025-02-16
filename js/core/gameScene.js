class GameScene {
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

    constructor(game) {
        this.#game = game;
        this.#logger = Logger.getInstance();
        this.#scene = game.getScene();
        this.#camera = game.getCamera();
        this.#player = game.getPlayer(); // Try to get player initially
        this.#setupTouchControls();
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
        this.#logger.info('Input started', {
            x,
            y,
            time: this.#inputStartTime,
            type: 'start'
        });
    }

    #handleInputMove(x, y) {
        if (!this.#isInputActive) {
            this.#logger.debug('Ignoring move event - input not active');
            return;
        }

        const deltaX = x - this.#lastInputX;
        const deltaY = y - this.#lastInputY;

        this.#logger.debug('Input movement', {
            deltaX,
            deltaY,
            currentX: x,
            currentY: y,
            type: 'move'
        });

        // Update camera rotation based on drag
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
            this.#cameraAngle += deltaX * this.#cameraRotationSpeed;
            this.#updateCameraPosition();
            this.#logger.debug('Camera rotated', {
                angle: this.#cameraAngle,
                type: 'camera'
            });
        }

        this.#lastInputX = x;
        this.#lastInputY = y;
    }

    #handleInputEnd() {
        if (!this.#isInputActive) {
            this.#logger.debug('Ignoring end event - input not active');
            return;
        }

        const deltaTime = Date.now() - this.#inputStartTime;
        const deltaX = this.#lastInputX - this.#inputStartX;
        const deltaY = this.#lastInputY - this.#inputStartY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        this.#logger.info('Input ended', {
            deltaTime,
            distance,
            deltaX,
            deltaY,
            type: 'end'
        });

        // If it's a quick tap (less than 200ms) and minimal movement (less than 10px),
        // treat it as a click/tap for movement
        if (deltaTime < 200 && distance < 10) {
            this.#logger.info('Quick tap detected - handling as movement', {
                x: this.#lastInputX,
                y: this.#lastInputY,
                type: 'tap'
            });
            this.#handleTapForMovement(this.#lastInputX, this.#lastInputY);
        }

        this.#isInputActive = false;
    }

    #handleTapForMovement(x, y) {
        // Convert screen coordinates to world coordinates
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        mouse.x = (x / window.innerWidth) * 2 - 1;
        mouse.y = -(y / window.innerHeight) * 2 + 1;

        this.#logger.debug('Converting screen to world coordinates', {
            screenX: x,
            screenY: y,
            normalizedX: mouse.x,
            normalizedY: mouse.y,
            type: 'coordinate_conversion'
        });

        // Update the picking ray with the camera and mouse position
        raycaster.setFromCamera(mouse, this.#camera);

        // Create a plane at y=0 to intersect with
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectPoint = new THREE.Vector3();

        // Find the point of intersection
        if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
            this.#logger.info('Found intersection point for movement', {
                x: intersectPoint.x,
                z: intersectPoint.z,
                type: 'movement_target'
            });
            
            // Move the player to this point
            if (this.#player) {
                this.#player.moveToPosition(intersectPoint.x, intersectPoint.z);
            } else {
                this.#logger.warn('No player available for movement');
            }
        } else {
            this.#logger.warn('No intersection found for movement');
        }
    }

    #updateCameraPosition() {
        if (!this.#camera || !this.#player) return;

        const playerPos = this.#player.getPosition();
        const cameraHeight = 3; // Lower height for third-person view
        const cameraDistance = 5; // Closer distance to player

        // Calculate camera position based on angle
        const x = playerPos.x - Math.sin(this.#cameraAngle) * cameraDistance;
        const z = playerPos.z - Math.cos(this.#cameraAngle) * cameraDistance;

        // Smoothly move camera to new position
        this.#camera.position.lerp(new THREE.Vector3(x, cameraHeight, z), 0.1);
        
        // Look slightly above the player for better perspective
        this.#camera.lookAt(playerPos.x, 1, playerPos.z);
    }

    update(deltaTime) {
        // Update player reference in case it was created after GameScene
        if (!this.#player) {
            this.#player = this.#game.getPlayer();
            if (this.#player) {
                this.#logger.info('Player reference obtained in GameScene');
            }
        }
        this.#updateCameraPosition();
    }
}
