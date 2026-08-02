/**
 * @file EventBus.js
 * @description A singleton event bus / pub-sub system.
 */
(function() {
    class EventBus {
        constructor() {
            this.listeners = {};
        }

        /**
         * Subscribe to an event
         * @param {string} event - The event name
         * @param {Function} cb - The callback function
         */
        on(event, cb) {
            if (!this.listeners[event]) {
                this.listeners[event] = [];
            }
            this.listeners[event].push(cb);
        }

        /**
         * Unsubscribe from an event
         * @param {string} event - The event name
         * @param {Function} cb - The callback function
         */
        off(event, cb) {
            if (!this.listeners[event]) return;
            this.listeners[event] = this.listeners[event].filter(listener => listener !== cb);
        }

        /**
         * Emit an event
         * @param {string} event - The event name
         * @param {any} data - The data to pass to callbacks
         */
        emit(event, data) {
            if (!this.listeners[event]) return;
            this.listeners[event].forEach(cb => {
                try {
                    cb(data);
                } catch (e) {
                    console.error(`Error in event listener for ${event}:`, e);
                }
            });
        }
    }

    window.EventBus = new EventBus();
})();
