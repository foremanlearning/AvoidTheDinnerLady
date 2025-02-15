class EventManager {
    static #instance = null;
    #events = new Map();
    #logger;
    #lastUpdateTime = 0;
    #updateInterval = 1000 / 60; // 60 FPS

    constructor() {
        if (EventManager.#instance) {
            return EventManager.#instance;
        }
        this.#logger = new Logger();
        EventManager.#instance = this;
    }

    static getInstance() {
        if (!EventManager.#instance) {
            EventManager.#instance = new EventManager();
        }
        return EventManager.#instance;
    }

    subscribe(eventName, callback) {
        if (!this.#events.has(eventName)) {
            this.#events.set(eventName, new Set());
        }
        this.#events.get(eventName).add(callback);
        this.#logger.debug(`Subscribed to event: ${eventName}`);
    }

    unsubscribe(eventName, callback) {
        if (this.#events.has(eventName)) {
            this.#events.get(eventName).delete(callback);
            this.#logger.debug(`Unsubscribed from event: ${eventName}`);
        }
    }

    emit(eventName, data) {
        // Only log non-update events or throttle update event logging
        if (eventName !== 'update' || Date.now() - this.#lastUpdateTime >= 1000) {
            this.#logger.debug(`Emitting event: ${eventName}`);
            this.#lastUpdateTime = Date.now();
        }

        if (this.#events.has(eventName)) {
            this.#events.get(eventName).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.#logger.error(`Error in event ${eventName} handler: ${error}`);
                }
            });
        }
    }

    clear() {
        this.#events.clear();
        this.#logger.debug('Cleared all event subscriptions');
    }
}
