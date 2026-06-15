////// BACKEND
const API = new (class GAppsApiClient {
  constructor() {}

  isAuthenticated() {
    const token = CACHE.getToken();
    return token != null && token.length > 0;
  }

  _performRequest({ action, method = "GET", body = null, parameters, requiresAuth = false, cache = null, onBackgroundUpdate = null } = {}) {
    return new Promise(async (resolve, reject) => {
      if(!action) {
        return reject("No s'ha especificat cap acció.");
      }

      console.log(`API Request - Action: ${action}, Method: ${method}, Requires Auth: ${requiresAuth}`);

      if(requiresAuth && !this.isAuthenticated()) {
        return reject("L'operació requereix autenticació. Si us plau, inicia sessió.");
      }

      const forceRefresh = parameters?.forceRefresh === true;
      if (cache && method === "GET" && !forceRefresh) {
        const cacheKey = CACHE._getCacheKey({ cache, parameters });
        const savedData = CACHE._read({ key: cacheKey });
        if (savedData) {
          resolve(savedData);
          if (onBackgroundUpdate && navigator.onLine) {
            this._revalidateInBackground({ action, method, parameters, requiresAuth, cache, onBackgroundUpdate, cachedData: savedData });
          }
          return;
        }
      }

      if (!navigator.onLine) {
        return reject(
          "No tens connexió a Internet. Comprova la teua xarxa i torna a intentar-ho.",
        );
      }

      const token = CACHE.getToken() || "";
      const returnResult = (data) => {
        if (data?.success) {
          if(cache){
            const cacheKey = CACHE._getCacheKey({ cache, parameters });
            CACHE._write({ key: cacheKey, data: data.result });
          }
          resolve(data.result);
        } else {
          let errorMessage = "Ha ocorregut un error en la petició. Si el problema persistix, contacta a l'administrador.";
          if (data) {
            errorMessage = data.error || data.message || errorMessage;
            if(action !== 'logout' && data.status === 401) {
              return AUTH.handleLogout({ message: "La teua sessió ha caducat. Per favor, torna a iniciar sessió.", messageType: "error" });
            }
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
            if (response.status === 401 && action !== "logout") {
              return AUTH.handleLogout({ message: "La teua sessió ha caducat. Per favor, torna a iniciar sessió." });
            }
            if (response.status === 403) {
              errorMessage =
                "No tens permís per a realitzar esta operació.";
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

  _revalidateInBackground({ action, method, parameters, requiresAuth, cache, onBackgroundUpdate, cachedData }) {
    const freshParams = { ...parameters, forceRefresh: true };
    this._performRequest({ action, method, parameters: freshParams, requiresAuth, cache })
      .then((freshData) => {
        if (JSON.stringify(freshData) !== JSON.stringify(cachedData)) {
          onBackgroundUpdate(freshData);
        }
      })
      .catch(() => {});
  }

  _get({ action, parameters, requiresAuth, cache = null, onBackgroundUpdate = null } = {}) {
    return this._performRequest({ action, method: "GET", parameters, requiresAuth, cache, onBackgroundUpdate });
  }

  _post({ action, body = null, parameters, requiresAuth, cache = null} = {}) {
    return this._performRequest({ action, method: "POST", body, parameters, requiresAuth, cache });
  }

  _patch({ action, body = null, parameters, requiresAuth, cache = null } = {}) {
    return this._performRequest({ action, method: "PATCH", body, parameters, requiresAuth, cache });
  }

  _put({ action, body = null, parameters, requiresAuth, cache = null } = {}) {
    return this._performRequest({ action, method: "PUT", body, parameters, requiresAuth, cache });
  }

  _delete({ action, body = null, parameters, requiresAuth, cache = null } = {}) {
    return this._performRequest({ action, method: "DELETE", body, parameters, requiresAuth, cache });
  }

  getCurrentUser() {
    return this._get({ action: "user", requiresAuth: true, cache: 'user' });
  }

  getDances() {
    return Promise.resolve(DANCES);
  }

  getDataVersions() {
    return this._get({ action: "dataVersions", requiresAuth: true });
  }

  getEvents({ forceRefresh = false, onBackgroundUpdate = null } = {}) {
    return this._get({ action: "events", parameters: { forceRefresh }, requiresAuth: true, cache: 'events', onBackgroundUpdate });
  }

  getEventById({ eventId } = {}) {
    return this._get({ action: "event", parameters: { eventId }, requiresAuth: true });
  }

  getNextEvent() {
    return this._get({ action: "nextEvent", requiresAuth: true });
  }
  
  getTrainings({ forceRefresh = false, onBackgroundUpdate = null } = {}) {
    return this._get({ action: "trainings", parameters: { forceRefresh }, requiresAuth: true, cache: 'trainings', onBackgroundUpdate });
  }

  getTrainingById({ trainingId } = {}) {
    return this._get({ action: "training", parameters: { trainingId, _t: Date.now() }, requiresAuth: true });
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

  getMembers({ forceRefresh = false, onBackgroundUpdate = null } = {}) {
    return this._get({ action: "members", parameters: { forceRefresh }, requiresAuth: true, cache: 'members', onBackgroundUpdate });
  }

  loginWithEmailPassword({ email, password } = {}) {
    return this._post({ action: "login", body: { email, password }, cache: 'user' });
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

  setEventVisibility({ eventName, visible } = {}) {
    return this._patch({ action: "setEventVisibility", body: { eventName, visible }, requiresAuth: true });
  }

  saveTraining({ training } = {}) {
    return this._put({ action: "saveTraining", body: { training }, requiresAuth: true });
  }

  confirmTrainingAttendance({ trainingId } = {}) {
    return this._post({ action: "confirmTrainingAttendance", body: { trainingId }, requiresAuth: true });
  }

  cancelTrainingAttendance({ trainingId } = {}) {
    return this._post({ action: "cancelTrainingAttendance", body: { trainingId }, requiresAuth: true });
  }

  confirmRelatedMemberAttendance({ trainingId, memberId, memberAlias } = {}) {
    return this._post({ action: "confirmRelatedMemberAttendance", body: { trainingId, memberId, memberAlias }, requiresAuth: true });
  }

  cancelRelatedMemberAttendance({ trainingId, memberId, memberAlias } = {}) {
    return this._post({ action: "cancelRelatedMemberAttendance", body: { trainingId, memberId, memberAlias }, requiresAuth: true });
  }

  adminSetMemberAttendance({ trainingId, memberAlias, attending } = {}) {
    return this._post({ action: "adminSetMemberAttendance", body: { trainingId, memberAlias, attending }, requiresAuth: true });
  }

  confirmEventMemberAttendance({ eventId, memberAlias, attending } = {}) {
    return this._post({ action: "confirmEventMemberAttendance", body: { eventId, memberAlias, attending }, requiresAuth: true });
  }

  saveTrainingNote({ trainingId, note } = {}) {
    return this._post({ action: "saveTrainingNote", body: { trainingId, note }, requiresAuth: true });
  }

  saveRelatedMemberTrainingNote({ trainingId, memberId, memberAlias, note } = {}) {
    return this._post({ action: "saveRelatedMemberTrainingNote", body: { trainingId, memberId, memberAlias, note }, requiresAuth: true });
  }

  getAudioById({ audioId } = {}) {
    return this._get({ action: "audio", parameters: { audioId }, requiresAuth: true, cache: 'audio' });
  }

  calculateEventDancePositions({ danceName, attendees } = {}) {
    return this._get({ action: "calculateEventDancePositions", parameters: { danceName, attendees: JSON.stringify(attendees || []) }, requiresAuth: true });
  }

  getMemberPositions({ memberAlias } = {}) {
    return this._get({ action: "memberPositions", parameters: { memberAlias }, requiresAuth: true });
  }

  updateMemberPosition({ memberAlias, danceName, positionOrder, value } = {}) {
    return this._patch({
      action: "updateMemberPosition",
      body: { memberAlias, danceName, positionOrder, value },
      requiresAuth: true,
    });
  }

  registerPushToken({ pushToken } = {}) {
    return this._post({ action: "registerPushToken", body: { pushToken }, requiresAuth: true });
  }

  sendCommunication({ title, message, recipientUserIds } = {}) {
    return this._post({ action: "sendCommunication", body: { title, message, recipientUserIds }, requiresAuth: true });
  }

  unregisterPushToken({ pushToken } = {}) {
    return this._delete({ action: "registerPushToken", body: { pushToken }, requiresAuth: true });
  }
})();
