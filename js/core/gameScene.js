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
    }

    #handleInputMove(x, y) {
        if (!this.#isInputActive) return;

        const deltaX = x - this.#lastInputX;
        const deltaY = y - this.#lastInputY;

        // Update camera rotation based on drag
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
            this.#cameraAngle += deltaX * this.#cameraRotationSpeed;
            this.#updateCameraPosition();
        }

        this.#lastInputX = x;
        this.#lastInputY = y;
    }

    #handleInputEnd() {
        if (!this.#isInputActive) return;

        const deltaTime = Date.now() - this.#inputStartTime;
        const deltaX = this.#lastInputX - this.#inputStartX;
        const deltaY = this.#lastInputY - this.#inputStartY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // If it's a quick tap (less than 200ms) and minimal movement (less than 10px),
        // treat it as a click/tap for movement
        if (deltaTime < 200 && distance < 10) {
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

        // Update the picking ray with the camera and mouse position
        raycaster.setFromCamera(mouse, this.#camera);

        // Create a plane at y=0 to intersect with
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectPoint = new THREE.Vector3();

        // Find the point of intersection
        if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
            // Move the player to this point
            if (this.#player) {
                this.#player.moveToPosition(intersectPoint.x, intersectPoint.z);
            }
        }
    }

    #updateCameraPosition() {
        if (!this.#camera || !this.#player) return;

        const playerPos = this.#player.getPosition();
        const cameraHeight = 20;
        const cameraDistance = 20;

        // Calculate camera position based on angle
        const x = playerPos.x + Math.sin(this.#cameraAngle) * cameraDistance;
        const z = playerPos.z + Math.cos(this.#cameraAngle) * cameraDistance;

        this.#camera.position.set(x, cameraHeight, z);
        this.#camera.lookAt(playerPos.x, 0, playerPos.z);
    }

    update(deltaTime) {
        this.#player = this.#game.getPlayer();
        if (this.#player) {
            this.#updateCameraPosition();
        }
    }
}
