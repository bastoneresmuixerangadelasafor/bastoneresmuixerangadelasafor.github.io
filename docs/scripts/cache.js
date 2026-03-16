
const CACHE = new (class CacheManager {
  constructor() {} 

  _getCacheKey({ cache, parameters } = {}) {
    const params = parameters ? Object.fromEntries(Object.entries(parameters).filter(([key]) => key !== "forceRefresh")) : {};
    const cacheKey = `${cache}${params && Object.keys(params).length > 0 ? `_${new URLSearchParams(params).toString()}` : ""}`;
    return cacheKey;
  }

  getToken() {
    try {
      const tokenData = localStorage.getItem(SESSION_TOKEN);
      if (!tokenData) return null;
      
      let token, expiryTime;
      try {
        const parsed = JSON.parse(tokenData);
        token = parsed.token;
        expiryTime = parsed.expiryTime;
      } catch (e) {
        token = tokenData;
        expiryTime = null;
      }
      
      if (expiryTime && Date.now() > expiryTime) {
        localStorage.removeItem(SESSION_TOKEN);
        return null;
      }
      
      return token;
    } catch (e) {
      console.log("Failed to retrieve token from storage:", e.message);
      return null;
    }
  }

  saveToken({ token } = {}) {
    try {
      if(!token) {
        localStorage.removeItem(SESSION_TOKEN);
      } else {
        const maxAge = 60 * 60 * 24 * 90;
        const expiryTime = Date.now() + (maxAge * 1000);
        const tokenData = JSON.stringify({ token, expiryTime });
        localStorage.setItem(SESSION_TOKEN, tokenData);
      }
    } catch (e) {
      console.log("Failed to save token to storage:", e.message);
    }
  }

  clearSession() {
    this.saveToken();
    this._write({ key: "user", data: null });
  }

  _write({ key, data } = {}) {
    if(key){
      if(!data){
        localStorage.removeItem(key);
      }else{
        localStorage.setItem(key, JSON.stringify(data));
      }
    }
  }

  _read({ key } = {}) {
    if(key){
      return JSON.parse(localStorage.getItem(key));
    }
  }

  getTrainings() {
    return this._read({ key: "trainings" });
  }

  saveTrainings({ trainings } = {}) {
    this._write({ key: "trainings", data: trainings });
  }

  getEvents() {
    return this._read({ key: "events" });
  }

  saveEvents({ events } = {}) {
    this._write({ key: "events", data: events });
  }
})();