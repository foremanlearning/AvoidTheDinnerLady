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
    #debugMode = false;
    #debugRanges = null;
    #debugText = null;
    #dinnerLadyConfig = null;

    constructor(game) {
        this.#game = game;
        this.#logger = Logger.getInstance();
        this.#scene = game.getScene();
        this.#camera = game.getCamera();
        this.#player = game.getPlayer(); // Try to get player initially
        this.#cameraTarget = this.#player; // Default camera target is player
        this.#loadDinnerLadyConfig();
        this.#setupTouchControls();
        this.#setupKeyboardControls();
        this.#setupDebugMode();
    }

    async #loadDinnerLadyConfig() {
        try {
            const response = await fetch('config/dinnerLady.ai');
            this.#dinnerLadyConfig = await response.json();
            this.#logger.info('Loaded dinner lady config in GameScene');
        } catch (error) {
            this.#logger.error('Failed to load dinner lady config in GameScene:', error);
        }
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

    #setupDebugMode() {
        // Add debug mode toggle with F3 key
        window.addEventListener('keydown', (event) => {
            if (event.key === 'F3') {
                this.#toggleDebugMode();
            }
        });
    }

    #toggleDebugMode() {
        this.#debugMode = !this.#debugMode;
        this.#logger.info('Debug mode:', this.#debugMode ? 'enabled' : 'disabled');
        
        if (this.#debugMode) {
            this.#createDebugVisuals();
        } else {
            this.#clearDebugVisuals();
        }
    }

    #createDebugVisuals() {
        // Clear any existing debug visuals
        this.#clearDebugVisuals();

        if (!this.#dinnerLadyConfig) {
            this.#logger.error('Cannot create debug visuals: dinner lady config not loaded');
            return;
        }

        const dinnerLady = this.#game.getDinnerLady();
        if (!dinnerLady) return;

        // Create range circles
        this.#debugRanges = new THREE.Group();
        this.#debugRanges.name = 'debugRanges';

        const rangeColors = {
            veryClose: 0xff0000, // Red
            close: 0xff6600,     // Orange
            medium: 0xffff00,    // Yellow
            far: 0x00ff00        // Green
        };

        // Get ranges from dinnerLady.ai config
        const ranges = this.#dinnerLadyConfig.distances;
        this.#logger.debug('Creating debug visuals with ranges:', ranges);

        // Create circles for each range
        Object.entries(ranges).forEach(([range, radius]) => {
            const geometry = new THREE.RingGeometry(radius - 0.1, radius, 32);
            const material = new THREE.MeshBasicMaterial({
                color: rangeColors[range],
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.3
            });
            const circle = new THREE.Mesh(geometry, material);
            circle.rotation.x = -Math.PI / 2; // Lay flat on ground
            circle.position.y = 0.1; // Slightly above ground
            this.#debugRanges.add(circle);
            this.#logger.debug(`Created ${range} range circle with radius ${radius}`);
        });

        // Create debug text for current action
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        
        this.#debugText = new THREE.Sprite(material);
        this.#debugText.scale.set(5, 1.25, 1);
        this.#debugText.position.y = 5;

        // Add debug elements to scene
        this.#scene.add(this.#debugRanges);
        this.#scene.add(this.#debugText);
    }

    #clearDebugVisuals() {
        if (this.#debugRanges) {
            this.#scene.remove(this.#debugRanges);
            this.#debugRanges.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.#debugRanges = null;
        }
        
        if (this.#debugText) {
            this.#scene.remove(this.#debugText);
            if (this.#debugText.material.map) {
                this.#debugText.material.map.dispose();
            }
            this.#debugText.material.dispose();
            this.#debugText = null;
        }
    }

    #updateDebugVisuals() {
        if (!this.#debugMode || !this.#dinnerLadyConfig) return;

        const dinnerLady = this.#game.getDinnerLady();
        if (!dinnerLady || !this.#debugRanges || !this.#debugText) return;

        // Update range circles position
        const dinnerLadyPos = dinnerLady.getPosition();
        this.#debugRanges.position.set(dinnerLadyPos.x, 0.1, dinnerLadyPos.z);

        // Update action text
        const canvas = this.#debugText.material.map.image;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set text style
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = '20px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Get current action and distance from player
        const player = this.#game.getPlayer();
        let distanceText = 'No Player';
        let actionText = 'Unknown';
        let audioText = 'No Audio';
        
        if (player) {
            const dx = player.getPosition().x - dinnerLadyPos.x;
            const dz = player.getPosition().z - dinnerLadyPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            distanceText = `Distance: ${distance.toFixed(1)}`;
            
            // Use ranges from config
            const ranges = this.#dinnerLadyConfig.distances;
            if (distance <= ranges.veryClose) actionText = 'VERY CLOSE!';
            else if (distance <= ranges.close) actionText = 'CLOSE';
            else if (distance <= ranges.medium) actionText = 'MEDIUM';
            else if (distance <= ranges.far) actionText = 'FAR';
            else actionText = 'OUT OF RANGE';

            // Get current audio file
            const audioManager = this.#game.getAudioManager();
            if (audioManager) {
                const currentAudioFile = audioManager.getCurrentAudioFile();
                if (currentAudioFile) {
                    // Extract just the filename from the path
                    audioText = `Playing: ${currentAudioFile.split('/').pop()}`;
                }
            }

            this.#logger.debug(`Player distance: ${distance}, Current range: ${actionText}, Audio: ${audioText}`);
        }

        // Draw text (now with three lines)
        context.fillText(actionText, canvas.width/2, canvas.height/4);
        context.fillText(distanceText, canvas.width/2, canvas.height/2);
        context.fillText(audioText, canvas.width/2, canvas.height*3/4);
        
        // Update texture
        this.#debugText.material.map.needsUpdate = true;
        
        // Position text above dinner lady
        this.#debugText.position.set(dinnerLadyPos.x, 5, dinnerLadyPos.z);
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

    resetState() {
        // Reset input state
        this.#isInputActive = false;
        this.#lastInputX = 0;
        this.#lastInputY = 0;
        this.#inputStartX = 0;
        this.#inputStartY = 0;
        this.#inputStartTime = 0;

        // Reset camera
        this.#cameraAngle = 0;
        
        // Get fresh references
        this.#player = this.#game.getPlayer();
        this.#cameraTarget = this.#player;

        // Clear any debug visuals if they exist
        if (this.#debugMode) {
            this.#clearDebugVisuals();
            this.#createDebugVisuals();
        }

        this.#logger.info('GameScene state reset');
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

        // Update debug visuals if enabled
        this.#updateDebugVisuals();
    }
};
