////// LOGGER
const LOG_ENABLED = true;
console = new Proxy(console, {
    get(target, prop) {
        if (!LOG_ENABLED) {
            return () => { };
        }
        return target[prop];
    }
});
