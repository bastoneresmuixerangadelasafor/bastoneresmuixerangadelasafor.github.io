const APP = new (class AppState{
  constructor() {
    this.currentUser = null;  
    this.isLoading = true;
    this.eventIdToLoad = null;
    this.trainingIdToLoad = null;
    this.currentEventId = null;
    this.currentTrainingId = null;
    this.currentTrainingData = null;

    document.addEventListener("DOMContentLoaded", () => {
      this._configureTheme();

      this._configurePWA();

      this._configureBackgroundRefresh();

      this._configureOfflineBanner();

      this.showLoading(true);

      this._configureSession();
    });
  }

  _configureTheme() {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

    if (savedTheme === "dark") {
      document.body.classList.add("dark-mode");
    } else if (savedTheme === "light") {
      document.body.classList.remove("dark-mode");
    } else if (prefersDark.matches) {
      document.body.classList.add("dark-mode");
    }

    prefersDark.addEventListener("change", (e) => {
      if (localStorage.getItem("theme")) return;
      if (e.matches) {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
    });

    const toggleBtns = document.querySelectorAll("#theme-toggle, #desktop-theme-toggle");
    toggleBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark-mode");
        localStorage.setItem("theme", isDark ? "dark" : "light");
      });
    });
  }

  _configurePWA() {
    if ("serviceWorker" in navigator) {
      if (window.self === window.top) {
        const isLocalFile = window.location.protocol === 'file:' || window.location.origin === 'null';
        if (!isLocalFile) {
          window.addEventListener("load", () => {
            const firebaseConfig = encodeURIComponent(JSON.stringify({
              apiKey: FIREBASE_API_KEY,
              authDomain: FIREBASE_AUTH_DOMAIN,
              projectId: FIREBASE_PROJECT_ID,
              messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
              appId: FIREBASE_APP_ID,
            }));
            navigator.serviceWorker
              .register('/sw.js?v=' + Date.now() + '&firebase=' + firebaseConfig)
              .then((registration) => {
                console.log(
                  "ServiceWorker registration successful with scope: ",
                  registration.scope,
                );
              })
              .catch((err) => {
                console.log("ServiceWorker registration failed: ", err);
              });
          });
        }
      }
    }
  }

  _configureOfflineBanner() {
    const updateOfflineState = () => {
      document.body.classList.toggle("is-offline", !navigator.onLine);
    };
    window.addEventListener("online", updateOfflineState);
    window.addEventListener("offline", updateOfflineState);
    updateOfflineState();
  }

  _configureSession() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      CACHE.saveToken({ token: urlToken });
      history.replaceState({}, '', window.location.pathname + window.location.hash);
    }

    API.getCurrentUser()
    .then((result) => {
      this.currentUser = result.user;

      initializeEventListeners();
      updateAuthUI();

      this.showLoading(false);
      this._startPolling(30 * 1000);

      NAVIGATION.goToLandingPage();

      if (typeof NOTIFICATIONS !== 'undefined') {
        NOTIFICATIONS.initialize();
      }
    })
    .catch((error) => {
      console.error("Auth check failed:", error);
      APP.user = null;

      initializeEventListeners();
      updateAuthUI();

      this.showLoading(false);
      this._stopPolling();

      NAVIGATION.goToLandingPage();
    });
  }

  _configureBackgroundRefresh() {
    this._lastHiddenAt = null;
    this._knownVersions = null;
    this._pollTimer = null;
    const STALE_THRESHOLD_MS = 5 * 60 * 1000;
    const POLL_INTERVAL_MS = 30 * 1000;

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this._lastHiddenAt = Date.now();
        this._stopPolling();
        return;
      }
      this._startPolling(POLL_INTERVAL_MS);
      if (!this._lastHiddenAt || !this.isAuthenticated) return;
      if (Date.now() - this._lastHiddenAt < STALE_THRESHOLD_MS) return;
      this._lastHiddenAt = null;
      this._pollForChanges();
    });

    window.addEventListener("pageshow", (e) => {
      if (!e.persisted) return;
      const view = NAVIGATION.currentView;
      if (view === "edit-event" && APP.currentEventId) {
        const field = document.getElementById("event-name-input");
        if (field && !field.value) {
          EVENTS.loadEventData(APP.currentEventId);
        }
      } else if (view === "edit-training" && APP.currentTrainingId) {
        const field = document.getElementById("training-date-input");
        if (field && !field.value) {
          TRAININGS.loadTrainingData(APP.currentTrainingId);
        }
      }
    });
  }

  _startPolling(intervalMs) {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(() => this._pollForChanges(), intervalMs);
  }

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  _pollForChanges() {
    if (!this.isAuthenticated || !navigator.onLine) return;

    API.getDataVersions()
      .then((versions) => {
        if (!this._knownVersions) {
          this._knownVersions = versions;
          return;
        }

        const changed = [];
        if (versions.trainings !== this._knownVersions.trainings) changed.push("trainings");
        if (versions.events !== this._knownVersions.events) changed.push("events");
        if (versions.members !== this._knownVersions.members) changed.push("members");
        this._knownVersions = versions;

        if (changed.length === 0) return;

        changed.forEach((dataType) => {
          CACHE._write({ key: dataType, data: null });
        });

        const view = NAVIGATION.currentView;
        if (changed.includes("trainings")) {
          if (view === "planning-training") TRAININGS.refreshPlanningTrainings();
          else if (view === "home") HOME.loadHomeData();
        }
        if (changed.includes("events")) {
          if (view === "planning-event") EVENTS.refreshPlanningEvents();
          else if (view === "home") HOME.loadHomeData();
        }
        if (changed.includes("members") && view === "members") {
          MEMBERS._refreshMembersList();
        }
      })
      .catch(() => {});
  }

  bumpLocalVersion(dataType) {
    if (this._knownVersions) {
      this._knownVersions[dataType] = Date.now();
    }
  }

  get isAuthenticated() {
    return !!this.currentUser;
  }

  showLoading(show) {
    const loadingScreen = document.getElementById("loading-screen");
    const app = document.getElementById("app");

    if (show) {
      loadingScreen.style.display = "flex";
      app.style.display = "none";
    } else {
      loadingScreen.style.display = "none";
      app.style.display = "flex";
    }

    this.isLoading = show;
  }

  loadViewData(view) {
    switch (view) {
      case "home":
        HOME.loadHomeData();
        break;
      case "dashboard":
        DASHBOARD.loadDashboardData();
        break;
      case "profile":
        AUTH.loadProfileData();
        break;
      case "members":
        MEMBERS.loadMembersData();
        break;
      case "edit-event":
        if (!MEMBERS.membersData || MEMBERS.membersData.length === 0) {
          MEMBERS.loadMembersDataForEvents();
        }
        if (APP.eventIdToLoad) {
          EVENTS.loadEventData(APP.eventIdToLoad);
          APP.eventIdToLoad = null;
        } else {
          const eventHash = window.location.hash.substring(1);
          if (eventHash.startsWith("events/")) {
            const recoveredId = decodeURIComponent(eventHash.substring(7));
            if (recoveredId) {
              EVENTS.loadEventData(escapeHtml(recoveredId));
              break;
            }
          }
          EVENTS.resetEventsForm();
        }
        break;
      case "edit-training":
        if (APP.trainingIdToLoad) {
          TRAININGS.loadTrainingData(APP.trainingIdToLoad);
          APP.trainingIdToLoad = null;
        } else {
          const trainingHash = window.location.hash.substring(1);
          if (trainingHash.startsWith("training/")) {
            const recoveredId = decodeURIComponent(trainingHash.substring(9));
            if (recoveredId) {
              TRAININGS.loadTrainingData(escapeHtml(recoveredId));
              break;
            }
          }
          TRAININGS.resetTrainingForm();
        }
        break;
      case "planning-event":
        EVENTS.loadPlanningEventData();
        break;
      case "planning-training":
        TRAININGS.loadPlanningTrainingData();
        break;
      case "member-positions":
        MEMBERS.loadMemberPositionsData();
        break;
    }
  }

  closeAllDialogs() {
    const dialogs = document.querySelectorAll('dialog[open]');
    dialogs.forEach(function (dialog) {
      if (dialog) dialog.close();
    });
    const backdrop = document.getElementById("dialog-backdrop");
    if (backdrop) {
      backdrop.classList.remove("active");
      backdrop.dataset.currentDialog = "";
    }
  }

  cancelCurrentEditMode() {
    if (MEMBERS.currentEditingMemberId !== null) {
      MEMBERS._cancelInlineEdit();
    }
    if (typeof diagramsIsDirty !== "undefined") {
      diagramsIsDirty = false;
    }
  }
})();


function initializeEventListeners() {
  


  

  const refreshEventsBtn = document.getElementById("refresh-event-btn");
  if (refreshEventsBtn) {
    refreshEventsBtn.addEventListener("click", () => EVENTS.refreshPlanningEvents());
  }

  const refreshTrainingsBtn = document.getElementById("refresh-training-btn");
  if (refreshTrainingsBtn) {
    refreshTrainingsBtn.addEventListener("click", () => TRAININGS.refreshPlanningTrainings());
  }



  const danceAudioCloseBtn = document.getElementById("dance-audio-close-btn");
  const danceAudioDialog = document.getElementById("dance-audio-dialog");
  if (danceAudioCloseBtn) {
    danceAudioCloseBtn.addEventListener("click", function () {
      if (danceAudioDialog) {
        UI.closeDialogWithBackdrop(danceAudioDialog);
      }
    });
  }

  if (danceAudioDialog) {
    danceAudioDialog.addEventListener("click", function (e) {
      if (e.target === this) {
        UI.closeDialogWithBackdrop(this);
      }
    });

    danceAudioDialog.addEventListener("close", function () {
      TRAININGS.stopAllAudioInDialog(danceAudioDialog);
    });
  }

  const positionValueCloseBtn = document.getElementById("position-value-close-btn");
  const positionValueDialog = document.getElementById("position-value-dialog");
  if (positionValueCloseBtn) {
    positionValueCloseBtn.addEventListener("click", function () {
      if (positionValueDialog) {
        UI.closeDialogWithBackdrop(positionValueDialog);
      }
    });
  }

  if (positionValueDialog) {
    positionValueDialog.addEventListener("click", function (e) {
      if (e.target === this) {
        UI.closeDialogWithBackdrop(this);
      }
    });
  }
}

function updateAuthUI() {
  const userInfo = document.getElementById("user-info");
  const authRequiredLinks = document.querySelectorAll(".auth-required");
  const adminOnlyElements = document.querySelectorAll(".admin-only");
  const nonAdminOnlyElements = document.querySelectorAll(".non-admin-only");
  const navbarToggle = document.getElementById("navbar-toggle");

  if (APP.isAuthenticated && APP.currentUser) {
    if (navbarToggle) navbarToggle.style.display = "block";
    if (userInfo) {
      userInfo.style.display = "flex";
      document.getElementById("user-avatar").src = APP.currentUser.avatar;
      document.getElementById("user-name").textContent =
        APP.currentUser.displayName;
    }

    const mobileUserSection = document.getElementById("mobile-user-section");
    const mobileUserAvatar = document.getElementById("mobile-user-avatar");
    const mobileUserName = document.getElementById("mobile-user-name");
    if (mobileUserAvatar) {
      mobileUserAvatar.src = APP.currentUser.avatar;
    }
    if (mobileUserName) {
      mobileUserName.textContent = APP.currentUser.displayName;
    }

    authRequiredLinks.forEach(function (link) {
      if (!link.classList.contains("admin-only")) {
        link.style.display = "";
      }
    });

    const userRoles = APP.currentUser.roles || [];
    const isAdmin = userRoles.includes("ADMIN");

    adminOnlyElements.forEach(function (el) {
      el.style.display = isAdmin ? "" : "none";
    });

    nonAdminOnlyElements.forEach(function (el) {
      el.style.display = isAdmin ? "none" : "";
    });

    document.querySelectorAll(".user-display-name").forEach(function (el) {
      el.textContent = APP.currentUser.displayName;
    });

    const homeUserName = document.getElementById("home-user-name");
    if (homeUserName) {
      homeUserName.textContent = APP.currentUser.displayName;
    }
  } else {
    if (navbarToggle) navbarToggle.style.display = "none";
    if (userInfo) userInfo.style.display = "none";

    authRequiredLinks.forEach(function (link) {
      link.style.display = "none";
    });

    adminOnlyElements.forEach(function (el) {
      el.style.display = "none";
    });

    nonAdminOnlyElements.forEach(function (el) {
      el.style.display = "none";
    });
  }

  if (typeof applyEditableState === "function") {
    applyEditableState();
  }

  NOTIFICATIONS.updateBellState();
}












