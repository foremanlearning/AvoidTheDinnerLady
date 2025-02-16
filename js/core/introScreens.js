class IntroScreens {
    static #instance = null;
    #logger = null;
    #game = null;
    #audioEnabled = false;
    #startMusic = null;
    #audioListener = null;

    constructor(game) {
        if (IntroScreens.#instance) {
            return IntroScreens.#instance;
        }
        IntroScreens.#instance = this;
        this.#game = game;
        this.#logger = Logger.getInstance();
        this.#audioListener = new THREE.AudioListener();
        this.#createAudioScreen();
    }

    #createAudioScreen() {
        const audioScreen = document.createElement('div');
        audioScreen.id = 'audioScreen';
        audioScreen.style.position = 'fixed';
        audioScreen.style.top = '0';
        audioScreen.style.left = '0';
        audioScreen.style.width = '100%';
        audioScreen.style.height = '100%';
        audioScreen.style.backgroundColor = 'black';
        audioScreen.style.display = 'flex';
        audioScreen.style.flexDirection = 'column';
        audioScreen.style.alignItems = 'center';
        audioScreen.style.justifyContent = 'center';
        audioScreen.style.zIndex = '1000';

        const button = document.createElement('button');
        button.textContent = 'Click to Enable Audio';
        button.style.padding = '20px 40px';
        button.style.fontSize = '24px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '10px';
        button.style.cursor = 'pointer';
        button.style.transition = 'background-color 0.3s';

        button.onmouseover = () => button.style.backgroundColor = '#45a049';
        button.onmouseout = () => button.style.backgroundColor = '#4CAF50';

        button.onclick = () => {
            this.#audioEnabled = true;
            audioScreen.remove();
            this.#createStartScreen();
        };

        audioScreen.appendChild(button);
        document.body.appendChild(audioScreen);
    }

    #createStartScreen() {
        const startScreen = document.createElement('div');
        startScreen.id = 'startScreen';
        startScreen.style.position = 'fixed';
        startScreen.style.top = '0';
        startScreen.style.left = '0';
        startScreen.style.width = '100%';
        startScreen.style.height = '100%';
        startScreen.style.backgroundImage = 'url("img/StartBackground.png")';
        startScreen.style.backgroundSize = 'cover';
        startScreen.style.backgroundPosition = 'center';
        startScreen.style.display = 'flex';
        startScreen.style.flexDirection = 'column';
        startScreen.style.alignItems = 'center';
        startScreen.style.justifyContent = 'center';
        startScreen.style.zIndex = '1000';

        // Load and play background music
        if (this.#audioEnabled) {
            this.#startMusic = new THREE.Audio(this.#audioListener);
            const audioLoader = new THREE.AudioLoader();
            
            audioLoader.load('audio/music/StartMenu.mp3', (buffer) => {
                this.#startMusic.setBuffer(buffer);
                this.#startMusic.setLoop(true);
                this.#startMusic.play();
                this.#logger.info('Start menu music loaded and playing');
            });
        }

        const startButton = document.createElement('button');
        startButton.textContent = 'Start Game';
        startButton.style.padding = '20px 40px';
        startButton.style.fontSize = '24px';
        startButton.style.backgroundColor = '#4CAF50';
        startButton.style.color = 'white';
        startButton.style.border = 'none';
        startButton.style.borderRadius = '10px';
        startButton.style.cursor = 'pointer';
        startButton.style.transition = 'background-color 0.3s';
        startButton.style.marginTop = '300px'; // Position below title

        startButton.onmouseover = () => startButton.style.backgroundColor = '#45a049';
        startButton.onmouseout = () => startButton.style.backgroundColor = '#4CAF50';

        startButton.onclick = () => {
            if (this.#startMusic) {
                this.#startMusic.stop();
            }
            startScreen.remove();
            // Start the actual game
            this.#game.start();
        };

        startScreen.appendChild(startButton);
        document.body.appendChild(startScreen);
    }

    static getInstance(game) {
        if (!IntroScreens.#instance) {
            IntroScreens.#instance = new IntroScreens(game);
        }
        return IntroScreens.#instance;
    }

    getAudioListener() {
        return this.#audioListener;
    }
}
