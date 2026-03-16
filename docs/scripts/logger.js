const LOGGER = new (class AppLogger {
  constructor() {
    this._enabled = true;

    const self = this;
    console = new Proxy(console, {
        get(target, prop) {
            if (!self._enabled) {
                return () => { };
            }
            return target[prop];
        }
    });
  }
})();
