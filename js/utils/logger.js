class Logger {
    static #instance = null;
    #consoleElement;
    #logLevel = 'info'; // debug, info, warn, error
    #lastLogTime = new Map();
    #throttleInterval = 1000; // 1 second

    constructor() {
        if (Logger.#instance) {
            return Logger.#instance;
        }
        this.#consoleElement = document.getElementById('debugConsole');
        Logger.#instance = this;
    }

    static getInstance() {
        if (!Logger.#instance) {
            Logger.#instance = new Logger();
        }
        return Logger.#instance;
    }

    setLogLevel(level) {
        this.#logLevel = level;
    }

    #shouldLog(type) {
        const levels = {
            'debug': 0,
            'info': 1,
            'warn': 2,
            'error': 3
        };
        return levels[type] >= levels[this.#logLevel];
    }

    #isThrottled(message, type) {
        const key = `${type}:${message}`;
        const now = Date.now();
        const lastTime = this.#lastLogTime.get(key) || 0;

        if (now - lastTime < this.#throttleInterval) {
            return true;
        }

        this.#lastLogTime.set(key, now);
        return false;
    }

    log(message, type = 'info') {
        if (!this.#shouldLog(type)) return;
        if (this.#isThrottled(message, type)) return;

        const timestamp = new Date().toLocaleTimeString();
        const formattedMessage = `[${timestamp}] [${type}] ${message}`;
        
        console.log(formattedMessage);
        
        if (GameConfig.debug && this.#consoleElement) {
            const messageElement = document.createElement('div');
            messageElement.textContent = formattedMessage;
            messageElement.className = `log-${type}`;
            this.#consoleElement.appendChild(messageElement);
            
            // Keep only last 50 messages
            while (this.#consoleElement.children.length > 50) {
                this.#consoleElement.removeChild(this.#consoleElement.firstChild);
            }
            
            this.#consoleElement.scrollTop = this.#consoleElement.scrollHeight;
        }
    }

    info(message) { this.log(message, 'info'); }
    warn(message) { this.log(message, 'warn'); }
    error(message) { this.log(message, 'error'); }
    debug(message) { this.log(message, 'debug'); }
}
