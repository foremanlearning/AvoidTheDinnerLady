class MinecraftCharacter {
    #head;
    #torso;
    #leftArm;
    #rightArm;
    #leftLeg;
    #rightLeg;
    #model;
    #isMoving = false;
    #animationTime = 0;

    constructor() {
        this.#model = new THREE.Group();
        
        // Materials
        const skinMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc99 }); // Skin color
        const shirtMaterial = new THREE.MeshPhongMaterial({ color: 0x3333cc }); // Blue shirt
        const pantsMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 }); // Gray pants
        
        // Head (2x2x2 units)
        const headGeometry = new THREE.BoxGeometry(1, 1, 1);
        this.#head = new THREE.Mesh(headGeometry, skinMaterial);
        this.#head.position.y = 3.5; // Position on top of torso
        this.#head.castShadow = true;
        
        // Torso (2x5x1 units)
        const torsoGeometry = new THREE.BoxGeometry(1, 2.5, 0.5);
        this.#torso = new THREE.Mesh(torsoGeometry, shirtMaterial);
        this.#torso.position.y = 2; // Half of torso height
        this.#torso.castShadow = true;
        
        // Arms (1x3x1 units)
        const armGeometry = new THREE.BoxGeometry(0.5, 1.5, 0.5);
        // Move geometry origin to top of arm
        armGeometry.translate(0, -0.75, 0);
        
        this.#leftArm = new THREE.Mesh(armGeometry, skinMaterial);
        this.#rightArm = new THREE.Mesh(armGeometry.clone(), skinMaterial);
        
        // Position arms at shoulder height
        this.#leftArm.position.set(0.75, 3.25, 0); // Slightly out from torso
        this.#rightArm.position.set(-0.75, 3.25, 0);
        this.#leftArm.castShadow = true;
        this.#rightArm.castShadow = true;
        
        // Add arm pivot points
        const leftArmPivot = new THREE.Group();
        const rightArmPivot = new THREE.Group();
        leftArmPivot.position.y = 0; // Move pivot to shoulder
        rightArmPivot.position.y = 0;
        this.#leftArm.add(leftArmPivot);
        this.#rightArm.add(rightArmPivot);
        
        // Legs (1x5x1 units)
        const legGeometry = new THREE.BoxGeometry(0.5, 2.5, 0.5);
        // Move geometry origin to top of leg
        legGeometry.translate(0, -1.25, 0);
        
        this.#leftLeg = new THREE.Mesh(legGeometry, pantsMaterial);
        this.#rightLeg = new THREE.Mesh(legGeometry.clone(), pantsMaterial);
        
        // Position legs at hip height
        this.#leftLeg.position.set(0.25, 2, 0);
        this.#rightLeg.position.set(-0.25, 2, 0);
        this.#leftLeg.castShadow = true;
        this.#rightLeg.castShadow = true;
        
        // Add leg pivot points
        const leftLegPivot = new THREE.Group();
        const rightLegPivot = new THREE.Group();
        leftLegPivot.position.y = 0; // Move pivot to hip
        rightLegPivot.position.y = 0;
        this.#leftLeg.add(leftLegPivot);
        this.#rightLeg.add(rightLegPivot);
        
        // Add all parts to the model
        this.#model.add(this.#head);
        this.#model.add(this.#torso);
        this.#model.add(this.#leftArm);
        this.#model.add(this.#rightArm);
        this.#model.add(this.#leftLeg);
        this.#model.add(this.#rightLeg);
        
        // Scale the entire model down
        this.#model.scale.set(0.4, 0.4, 0.4);
    }
    
    update(deltaTime) {
        if (this.#isMoving) {
            this.#animationTime += deltaTime * 5;
            
            // Animate arms and legs
            const swingAngle = Math.sin(this.#animationTime) * 0.5;
            
            // Arms swing opposite to each other
            this.#leftArm.rotation.x = swingAngle;
            this.#rightArm.rotation.x = -swingAngle;
            
            // Legs swing opposite to each other
            this.#leftLeg.rotation.x = -swingAngle;
            this.#rightLeg.rotation.x = swingAngle;
        } else {
            // Reset animations when not moving
            this.#animationTime = 0;
            this.#leftArm.rotation.x = 0;
            this.#rightArm.rotation.x = 0;
            this.#leftLeg.rotation.x = 0;
            this.#rightLeg.rotation.x = 0;
        }
    }
    
    setMoving(isMoving) {
        this.#isMoving = isMoving;
    }
    
    getModel() {
        return this.#model;
    }
    
    setRotation(angle) {
        this.#model.rotation.y = angle;
    }
}
