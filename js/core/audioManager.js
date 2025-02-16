class AudioManager {
    static #instance = null;
    #logger = null;
    #audioListener = null;
    #sounds = new Map();
    #lastPlayedRange = null;
    #currentSound = null;
    #soundQueue = [];
    #isPlaying = false;
    #currentAudioFile = null;

    constructor() {
        if (AudioManager.#instance) {
            return AudioManager.#instance;
        }
        AudioManager.#instance = this;
        this.#logger = Logger.getInstance();
        this.#audioListener = new THREE.AudioListener();
    }

    static getInstance() {
        if (!AudioManager.#instance) {
            AudioManager.#instance = new AudioManager();
        }
        return AudioManager.#instance;
    }

    getListener() {
        return this.#audioListener;
    }

    async initialize() {
        try {
            this.#logger.info('Initializing AudioManager...');
            
            // Load all dinner lady sounds
            const soundFiles = {
                'farRange': 'audio/dinnerLady/dinnerLady/OnFarRange.wav',
                'mediumRange': 'audio/dinnerLady/dinnerLady/OnMediumRange.wav',
                'closeRange': 'audio/dinnerLady/dinnerLady/OnCloseRange.wav',
                'veryClose': 'audio/dinnerLady/dinnerLady/OnVeryClose.wav',
                'capture': 'audio/dinnerLady/dinnerLady/OnCapture.wav'
            };

            const audioLoader = new THREE.AudioLoader();
            
            for (const [key, path] of Object.entries(soundFiles)) {
                try {
                    this.#logger.debug(`Loading sound: ${key} from ${path}`);
                    const buffer = await audioLoader.loadAsync(path);
                    const sound = new THREE.Audio(this.#audioListener);
                    sound.setBuffer(buffer);
                    
                    // Add onEnded callback to handle queue
                    sound.onEnded(() => {
                        this.#logger.debug(`Sound finished: ${key}`);
                        this.#isPlaying = false;
                        this.#currentSound = null;
                        this.#playNextInQueue();
                    });
                    
                    this.#sounds.set(key, sound);
                    this.#logger.debug(`Loaded sound: ${key}`);
                } catch (error) {
                    this.#logger.error(`Failed to load sound: ${key}`, error);
                }
            }

            this.#logger.info('AudioManager initialized successfully');
            return true;
        } catch (error) {
            this.#logger.error('Failed to initialize AudioManager:', error);
            return false;
        }
    }

    #playNextInQueue() {
        if (this.#isPlaying || this.#soundQueue.length === 0) return;

        const nextSound = this.#soundQueue.shift();
        if (nextSound) {
            this.#logger.debug(`Playing queued sound: ${nextSound.key}`);
            this.#currentSound = this.#sounds.get(nextSound.key);
            if (this.#currentSound && !this.#currentSound.isPlaying) {
                this.#isPlaying = true;
                this.#currentAudioFile = `audio/dinnerLady/dinnerLady/On${nextSound.key}.wav`;
                this.#currentSound.play();
            }
        }
    }

    #queueSound(key) {
        // Don't queue if this range was the last one played
        if (key === this.#lastPlayedRange) return;
        
        this.#logger.debug(`Queuing sound: ${key}`);
        this.#lastPlayedRange = key;
        
        // Add to queue
        this.#soundQueue.push({ key, timestamp: Date.now() });
        
        // Try to play if nothing is currently playing
        if (!this.#isPlaying) {
            this.#playNextInQueue();
        }
    }

    playRangeSound(range) {
        const soundKey = {
            'far': 'farRange',
            'medium': 'mediumRange',
            'close': 'closeRange',
            'veryClose': 'veryClose'
        }[range];

        if (soundKey) {
            this.#queueSound(soundKey);
        }
    }

    playCaptureSound() {
        // Clear queue and play capture sound immediately
        this.#soundQueue = [];
        if (this.#currentSound && this.#currentSound.isPlaying) {
            this.#currentSound.stop();
        }
        this.#isPlaying = false;
        this.#currentSound = null;
        
        const sound = this.#sounds.get('capture');
        if (sound && !sound.isPlaying) {
            this.#logger.debug('Playing capture sound');
            this.#currentSound = sound;
            this.#isPlaying = true;
            sound.play();
        }
    }

    resetState() {
        this.#lastPlayedRange = null;
        this.#soundQueue = [];
        this.#isPlaying = false;
        this.#currentAudioFile = null;
        
        // Stop all currently playing sounds
        if (this.#currentSound && this.#currentSound.isPlaying) {
            this.#currentSound.stop();
        }
        this.#currentSound = null;
        
        this.#sounds.forEach(sound => {
            if (sound.isPlaying) {
                sound.stop();
            }
        });
    }

    getCurrentAudioFile() {
        return this.#currentAudioFile;
    }
}
