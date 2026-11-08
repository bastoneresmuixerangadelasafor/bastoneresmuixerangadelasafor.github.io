
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
        const parsed = JSON.parse(tokenData);
        if (typeof API_BACKEND === "undefined" || API_BACKEND !== "supabase" || !parsed.refreshToken) {
          localStorage.removeItem(SESSION_TOKEN);
          return null;
        }
      }
      
      return token;
    } catch (e) {
      console.log("Failed to retrieve token from storage:", e.message);
      return null;
    }
  }

  saveToken({ token, refreshToken, expiresAt } = {}) {
    try {
      if(!token) {
        localStorage.removeItem(SESSION_TOKEN);
      } else {
        let oldData = {};
        try {
          oldData = JSON.parse(localStorage.getItem(SESSION_TOKEN) || "{}");
        } catch (e) {
          oldData = {};
        }
        const maxAge = 60 * 60 * 24 * 90;
        const expiryTime = expiresAt ? expiresAt * 1000 : Date.now() + (maxAge * 1000);
        const tokenData = JSON.stringify({
          token,
          expiryTime,
          refreshToken: refreshToken || oldData.refreshToken,
        });
        localStorage.setItem(SESSION_TOKEN, tokenData);
      }
    } catch (e) {
      console.log("Failed to save token to storage:", e.message);
    }
  }

  async refreshSupabaseToken() {
    let tokenData = {};
    try {
      tokenData = JSON.parse(localStorage.getItem(SESSION_TOKEN) || "{}");
    } catch (e) {
      return this.getToken();
    }
    if (!tokenData.token) return null;
    if (!tokenData.refreshToken || !tokenData.expiryTime || Date.now() < tokenData.expiryTime - 60000) {
      return tokenData.token;
    }
    if (this.refreshPromise_) return this.refreshPromise_;

    this.refreshPromise_ = (async () => {
      const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: tokenData.refreshToken }),
      });
      const session = await response.json();
      if (!response.ok || !session.access_token) {
        this.clearSession();
        throw new Error(session.msg || session.message || "La sessió ha caducat. Inicia sessió de nou.");
      }
      this.saveToken({
        token: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at,
      });
      return session.access_token;
    })().finally(() => {
      this.refreshPromise_ = null;
    });
    return this.refreshPromise_;
  }

  clearSession() {
    this.saveToken();
    this._write({ key: "user", data: null });
  }

  _write({ key, data } = {}) {
    if(key){
      const storageKey = this._storageKey(key);
      if(!data){
        localStorage.removeItem(storageKey);
      }else{
        localStorage.setItem(storageKey, JSON.stringify(data));
      }
    }
  }

  _storageKey(key) {
    return typeof API_BACKEND !== "undefined" && API_BACKEND === "supabase"
      ? `supabase:${key}`
      : key;
  }

  _read({ key } = {}) {
    if(key){
      return JSON.parse(localStorage.getItem(this._storageKey(key)));
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