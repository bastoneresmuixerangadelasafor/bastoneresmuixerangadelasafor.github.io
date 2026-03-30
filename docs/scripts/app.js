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
            navigator.serviceWorker
              .register('/sw.js?v=' + Date.now())
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

  _configureSession() {
    API.getCurrentUser()
    .then((result) => {
      this.currentUser = result.user;

      initializeEventListeners();
      updateAuthUI();

      this.showLoading(false);

      NAVIGATION.goToLandingPage();
    })
    .catch((error) => {
      console.error("Auth check failed:", error);
      APP.user = null;

      initializeEventListeners();
      updateAuthUI();

      this.showLoading(false);

      NAVIGATION.goToLandingPage();
    });
  }

  _configureBackgroundRefresh() {
    this._lastHiddenAt = null;
    const STALE_THRESHOLD_MS = 5 * 60 * 1000;

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this._lastHiddenAt = Date.now();
        return;
      }
      if (!this._lastHiddenAt || !this.isAuthenticated) return;
      if (Date.now() - this._lastHiddenAt < STALE_THRESHOLD_MS) return;
      this._lastHiddenAt = null;

      const view = NAVIGATION.currentView;
      if (view === "planning-training") {
        TRAININGS.refreshPlanningTrainings();
      } else if (view === "planning-event") {
        EVENTS.refreshPlanningEvents();
      } else if (view === "members") {
        MEMBERS._refreshMembersList();
      } else if (view === "home") {
        HOME.loadHomeData();
      }
    });
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
          EVENTS.resetEventsForm();
        }
        break;
      case "edit-training":
        if (APP.trainingIdToLoad) {
          TRAININGS.loadTrainingData(APP.trainingIdToLoad);
          APP.trainingIdToLoad = null;
        } else {
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
}












