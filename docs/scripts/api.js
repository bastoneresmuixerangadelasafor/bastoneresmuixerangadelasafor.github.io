////// BACKEND
const API = new (class GAppsApiClient {
  constructor() {}

  getToken() {
    try {
      const tokenData = localStorage.getItem(SESSION_TOKEN);
      if (!tokenData) return null;
      
      // Parse stored token data
      let token, expiryTime;
      try {
        const parsed = JSON.parse(tokenData);
        token = parsed.token;
        expiryTime = parsed.expiryTime;
      } catch (e) {
        // Handle legacy format (plain token string without expiry)
        token = tokenData;
        expiryTime = null;
      }
      
      // Check if token has expired
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

  isAuthenticated() {
    const token = this.getToken();
    return token != null && token.length > 0;
  }

  saveToken({ token } = {}) {
    try {
      if(!token) {
        localStorage.removeItem(SESSION_TOKEN);
      } else {
        const maxAge = 60 * 60 * 24 * 90; // 90 days in seconds
        const expiryTime = Date.now() + (maxAge * 1000); // Convert to milliseconds
        const tokenData = JSON.stringify({ token, expiryTime });
        localStorage.setItem(SESSION_TOKEN, tokenData);
      }
    } catch (e) {
      console.log("Failed to save token to storage:", e.message);
    }
  }

  clearSession() {
    this.saveToken();
    this._write({ action: "user", data: null });
  }

  _write({ action, data } = {}) {
    if(action){
      if(!data){
        localStorage.removeItem(action);
      }else{
        localStorage.setItem(action, JSON.stringify(data));
      }
    }
  }

  _read({ action } = {}) {
    if(action){
      return JSON.parse(localStorage.getItem(action));
    }
  }

  _performRequest({ action, method = "GET", body = null, parameters, requiresAuth = false, useCache = false } = {}) {
    return new Promise(async (resolve, reject) => {
      if(!action) {
        return reject("No s'ha especificat cap acció.");
      }

      console.log(`API Request - Action: ${action}, Method: ${method}, Requires Auth: ${requiresAuth}`);

      if(requiresAuth && !this.isAuthenticated()) {
        return reject("L'operació requereix autenticació. Si us plau, inicia sessió.");
      }

      if (useCache) {
        const savedData = this._read({ action });
        if (savedData) {
          return resolve(savedData);
        }
      }

      if (!navigator.onLine) {
        return reject(
          "No tens connexió a Internet. Comprova la teua xarxa i torna a intentar-ho.",
        );
      }

      const token = this.getToken() || "";
      const returnResult = (data) => {
        if (data?.success) {
          this._write({ action, data: data.result });
          resolve(data.result);
        } else {
          let errorMessage = "Ha ocorregut un error en la petició. Si el problema persistix, contacta a l'administrador.";
          if (data) {
            errorMessage = data.error || data.message || errorMessage;
          }
          reject(errorMessage);
        }
      };

      if (typeof google !== "undefined" && google.script && google.script.run) {
        // Development mode using google.script.run
        const devParameters = { ...parameters, token };
        google.script.run
          .withSuccessHandler(returnResult)
          .withFailureHandler(returnResult)
          .test({ action, method, body, parameters: devParameters });
      } else {
        const options = {
          method: method == "GET" ? "GET" : "POST",
          cache: "no-cache",
          mode: "cors", // Use 'cors' to try and read the body
          headers: {
            // CRITICAL: Using 'text/plain' avoids CORS preflight
            "Content-Type": "text/plain;charset=utf-8",
          },
        };
        if (body) {
          options.body = JSON.stringify(body);
        }

        const urlparams = parameters
          ? `&${new URLSearchParams(parameters).toString()}`
          : "";
        try {
          const response = await fetch(
            `${API_URL}?action=${action}&method=${method}&token=${token}${urlparams}`,
            options,
          );

          if (!response.ok) {
            let errorMessage = `Error del servidor (${response.status}). Si el problema persistix, contacta a l'administrador.`;
            if (response.status === 401 || response.status === 403) {
              errorMessage =
                "No tens permís per a realitzar esta operació. Potser la teua sessió ha caducat.";
            }
            // In case of a redirect to a Google login page, the response might be opaque and we can't read the body.
            // For other errors, we can try to get more info.
            if (response.type !== "opaque") {
              try {
                const errorBody = await response.text();
                // Google Apps Script can return HTML with 'requires authentication'
                if (errorBody.includes("requires authentication")) {
                  errorMessage =
                    "La teua sessió ha caducat. Per favor, torna a iniciar sessió.";
                }
              } catch (e) {
                // Ignore if we can't read body, use the generic message.
              }
            }
            reject(errorMessage);
            return; // Stop further execution
          }

          const data = await response.json();
          returnResult(data);
        } catch (error) {
          this._handleRequestError(error).then(resolve).catch(reject);
        }
      }
    });
  }

  async _handleRequestError(error) {
    if (error instanceof SyntaxError) {
      return {success: false, error:
        "Hi ha hagut un problema en la resposta del servidor. Açò pot ser degut a un error intern o de configuració. Contacta a l'administrador.",
      };
    } else if (
      error instanceof TypeError &&
      error.message === "Failed to fetch"
    ) {
      try {
        // Use no-cors to avoid CORS issues with the check. We just want to see if we can reach the internet.
        await fetch("favicon.ico", { mode: "no-cors" });
        // If this succeeds, the user has internet, but the API server is unreachable or there's a CORS/Firewall issue.
        return {success: false, error:
          "No s'ha pogut connectar al servidor de l'aplicació. Pot ser que estiga temporalment fora de servei o que un tallafoc estiga bloquejant la connexió.",
        };
      } catch (e) {
        // If this fails, the user likely has no internet connection at all.
        return {success: false, error:
          "No s'ha pogut connectar a Internet. Comprova la teua xarxa i torna a intentar-ho.",
        };
      }
    } else {
      console.error("Error no controlat a l'API:", error);
      return {
        success: false,
        error: "Ha ocorregut un error inesperat. Per favor, intenta-ho de nou més tard.",
      };
    }
  }

  _get({ action, parameters, requiresAuth, useCache = false } = {}) {
    return this._performRequest({ action, method: "GET", parameters, requiresAuth, useCache });
  }

  _post({ action, body = null, parameters, requiresAuth, useCache = false} = {}) {
    return this._performRequest({ action, method: "POST", body, parameters, requiresAuth, useCache });
  }

  _patch({ action, body = null, parameters, requiresAuth, useCache = false } = {}) {
    return this._performRequest({ action, method: "PATCH", body, parameters, requiresAuth, useCache });
  }

  _put({ action, body = null, parameters, requiresAuth, useCache = false } = {}) {
    return this._performRequest({ action, method: "PUT", body, parameters, requiresAuth, useCache });
  }

  getCurrentUser() {
    return this._get({ action: "user", requiresAuth: true, useCache: true });
  }

  getDances() {
    return Promise.resolve(DANCES);
  }

  getEvents({ forceRefresh = false } = {}) {
    return this._get({ action: "events", parameters: { forceRefresh }, requiresAuth: true, useCache: !forceRefresh });
  }

  getEventById({ eventId } = {}) {
    return this._get({ action: "event", parameters: { eventId }, requiresAuth: true });
  }

  getNextEvent() {
    return this._get({ action: "nextEvent", requiresAuth: true });
  }
  
  getTrainings({ forceRefresh = false } = {}) {
    return this._get({ action: "trainings", parameters: { forceRefresh }, requiresAuth: true, useCache: !forceRefresh });
  }

  getTrainingById({ trainingId } = {}) {
    return this._get({ action: "training", parameters: { trainingId }, requiresAuth: true });
  }

  getNextTraining() {
    return this._get({ action: "nextTraining", requiresAuth: true });
  }

  getDashboardStats() {
    //return this._get({ action: "dashboard/stats", requiresAuth: true });
  }

  getUserActivity() {
    //return this._get({ action: "dashboard/activity", requiresAuth: true });
  }

  getMembers({ forceRefresh = false } = {}) {
    return this._get({ action: "members", parameters: { forceRefresh }, requiresAuth: true, useCache: !forceRefresh });
  }

  loginWithEmailPassword({ email, password } = {}) {
    return this._post({ action: "login", body: { email, password } });
  }

  sendAccessLink({ email } = {}) {
    return this._post({ action: "sendAccessLink", body: { email } });
  }

  sendRegistrationRequest({ name, email } = {}) {
    return this._post({ action: "register", body: { name, email } });
  }

  logoutUser() {
    return this._post({ action: "logout" })
    .then(() => {
      this.clearSession();
    });
  }

  changeUserPassword({ email, newPassword } = {}) {
    return this._patch({
      action: "changePassword",
      body: { email, newPassword },
      requiresAuth: true,
    });
  }

  saveMember({ member } = {}) {
    return this._put({ action: "saveMember", body: { member }, requiresAuth: true });
  }

  saveAllMembers({ members } = {}) {
    return this._put({ action: "saveAllMembers", body: { members }, requiresAuth: true });
  }

  saveEvent({ event } = {}) {
    return this._put({ action: "saveEvent", body: { event }, requiresAuth: true });
  }

  getAudioById({ audioId } = {}) {
    return this._get({ action: "audio", parameters: { audioId }, requiresAuth: true, useCache: true });
  }
})();
