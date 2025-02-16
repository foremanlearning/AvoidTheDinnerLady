class Logger {
    static #instance = null;
    #logLevel = 'debug'; // Default log level

    constructor() {
        if (Logger.#instance) {
            return Logger.#instance;
        }
        Logger.#instance = this;
    }

    static getInstance() {
        if (!Logger.#instance) {
            Logger.#instance = new Logger();
        }
        return Logger.#instance;
    }

    setLogLevel(level) {
        if (['debug', 'info', 'warn', 'error'].includes(level)) {
            this.#logLevel = level;
        }
    }

    #shouldLog(level) {
        const levels = {
            'debug': 0,
            'info': 1,
            'warn': 2,
            'error': 3
        };
        return levels[level] >= levels[this.#logLevel];
    }

    #log(level, message, data = null) {
        if (!this.#shouldLog(level)) return;

        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;

        switch (level) {
            case 'debug':
                if (data) {
                    console.debug(logMessage, data);
                } else {
                    console.debug(logMessage);
                }
                break;
            case 'info':
                if (data) {
                    console.info(logMessage, data);
                } else {
                    console.info(logMessage);
                }
                break;
            case 'warn':
                if (data) {
                    console.warn(logMessage, data);
                } else {
                    console.warn(logMessage);
                }
                break;
            case 'error':
                if (data) {
                    console.error(logMessage, data);
                } else {
                    console.error(logMessage);
                }
                break;
        }
    }

    debug(message, data = null) {
        this.#log('debug', message, data);
    }

    info(message, data = null) {
        this.#log('info', message, data);
    }

    warn(message, data = null) {
        this.#log('warn', message, data);
    }

    error(message, data = null) {
        this.#log('error', message, data);
    }
}
