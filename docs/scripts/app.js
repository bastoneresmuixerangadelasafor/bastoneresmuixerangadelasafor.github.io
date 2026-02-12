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

      this.showLoading(true);

      this._configureSession();
    });
  }

  _configureTheme() {
    // Check if browser prefers dark mode
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

    // Apply dark mode if preferred
    if (prefersDark.matches) {
      document.body.classList.add("dark-mode");
    }

    // Listen for changes to the system preference
    prefersDark.addEventListener("change", function (e) {
      if (e.matches) {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
    });
  }

  _configurePWA() {
    if ("serviceWorker" in navigator) {
      if (window.self === window.top) {
        const isLocalFile = window.location.protocol === 'file:' || window.location.origin === 'null';
        if (!isLocalFile) {
          window.addEventListener("load", () => {
            navigator.serviceWorker
              .register("./sw.js")
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
        loadHomeData();
        break;
      case "dashboard":
        loadDashboardData();
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
        // Load event data if ID is stored
        if (APP.eventIdToLoad) {
          loadEventData(APP.eventIdToLoad);
          APP.eventIdToLoad = null;
        } else {
          resetEventsForm();
        }
        break;
      case "edit-training":
        // Load training data if ID is stored
        if (APP.trainingIdToLoad) {
          loadTrainingData(APP.trainingIdToLoad);
          APP.trainingIdToLoad = null;
        } else {
          resetTrainingForm();
        }
        break;
      case "planning-event":
        loadPlanningEventData();
        break;
      case "planning-training":
        loadPlanningTrainingData();
        break;
    }
  }

  closeAllDialogs() {
    const dialogs = document.querySelectorAll('dialog[open]');
    dialogs.forEach(function (dialog) {
      if (dialog) dialog.close();
    });
    // Also hide the backdrop
    const backdrop = document.getElementById("dialog-backdrop");
    if (backdrop) {
      backdrop.classList.remove("active");
      backdrop.dataset.currentDialog = "";
    }
  }
})();

// Track pending diagram load intervals to prevent stale closures
let pendingDiagramLoadInterval = null;

/**
 * Cancel current edit mode (for navigation confirmation)
 */
function cancelCurrentEditMode() {
  // Cancel members inline edit if active
  if (MEMBERS.currentEditingMemberId !== null) {
    cancelInlineEdit();
  }
  // Reset events dirty flag
  if (typeof diagramsIsDirty !== "undefined") {
    diagramsIsDirty = false;
  }
}

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  


  

  // Refresh events button (planning view)
  const refreshEventsBtn = document.getElementById("refresh-event-btn");
  if (refreshEventsBtn) {
    refreshEventsBtn.addEventListener("click", refreshPlanningEvents);
  }

  // Refresh trainings button (planning view)
  const refreshTrainingsBtn = document.getElementById("refresh-training-btn");
  if (refreshTrainingsBtn) {
    refreshTrainingsBtn.addEventListener("click", refreshPlanningTrainings);
  }



  // Dance audio dialog close button
  const danceAudioCloseBtn = document.getElementById("dance-audio-close-btn");
  const danceAudioDialog = document.getElementById("dance-audio-dialog");
  if (danceAudioCloseBtn) {
    danceAudioCloseBtn.addEventListener("click", function () {
      if (danceAudioDialog) {
        closeDialogWithBackdrop(danceAudioDialog);
      }
    });
  }

  // Close dance audio dialog when clicking on backdrop
  if (danceAudioDialog) {
    danceAudioDialog.addEventListener("click", function (e) {
      if (e.target === this) {
        closeDialogWithBackdrop(this);
      }
    });

    // Stop all audio when dialog closes
    danceAudioDialog.addEventListener("close", function () {
      stopAllAudioInDialog(danceAudioDialog);
    });
  }
}





/**
 * Load home data
 */
function loadHomeData() {
  const userNameEl = document.getElementById("home-user-name");
  if (userNameEl) {
    if (APP.currentUser && APP.currentUser.displayName) {
      // Build greeting with user name and relations
      const names = [APP.currentUser.displayName];
      const relations = APP.currentUser.relatedMembers || [];
      if (relations.length > 0) {
        names.push(...relations.map((rel) => rel.name || rel.name).filter(Boolean));
      }
      userNameEl.textContent = formatNamesList(names);
    } else {
      userNameEl.textContent = "";
    }
  }

  // Load next event text
  const nextEventTextEl = document.getElementById("next-event-text");
  if (nextEventTextEl && APP.isAuthenticated) {
    API.getNextEvent()
      .then(function (result) {
        if (result && result.eventData) {
          nextEventTextEl.textContent = formatEventDate(result.eventData);
        } else {
          nextEventTextEl.textContent = "Sense proper esdeveniment programat";
        }
      })
      .catch(function (error) {
        console.error("Error loading next event:", error);
        nextEventTextEl.textContent = "Error carregant dades";
      });
  }

  // Load next training text
  const nextTrainingTextEl = document.getElementById("next-training-text");
  if (nextTrainingTextEl && APP.isAuthenticated) {
    API.getNextTraining()
      .then(function (result) {
        if (result && result.trainingData) {
          nextTrainingTextEl.textContent = formatEventDate(result.trainingData);
        } else {
          nextTrainingTextEl.textContent = "Sense proper assaig programat";
        }
      })
      .catch(function (error) {
        console.error("Error loading next training:", error);
        nextTrainingTextEl.textContent = "Error carregant dades";
      });
  }
}

/**
 * Format a list of names for display in greeting
 * @param {string[]} names - Array of names
 * @returns {string} Formatted names (e.g., "Joan, Maria i Pere")
 */
function formatNamesList(names) {
  if (!names || names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return names[0] + " i " + names[1];
  // For 3+ names: "Name1, Name2, ... i LastName"
  const lastIndex = names.length - 1;
  return names.slice(0, lastIndex).join(", ") + " i " + names[lastIndex];
}

/**
 * Update authentication UI elements
 */
function updateAuthUI() {
  const userInfo = document.getElementById("user-info");
  const authRequiredLinks = document.querySelectorAll(".auth-required");
  const adminOnlyElements = document.querySelectorAll(".admin-only");
  const nonAdminOnlyElements = document.querySelectorAll(".non-admin-only");
  const navbarToggle = document.getElementById("navbar-toggle");

  if (APP.isAuthenticated && APP.currentUser) {
    if (navbarToggle) navbarToggle.style.display = "block";
    // Show user info
    if (userInfo) {
      userInfo.style.display = "flex";
      document.getElementById("user-avatar").src = APP.currentUser.avatar;
      document.getElementById("user-name").textContent =
        APP.currentUser.displayName;
    }

    // Update mobile user section
    const mobileUserSection = document.getElementById("mobile-user-section");
    const mobileUserAvatar = document.getElementById("mobile-user-avatar");
    const mobileUserName = document.getElementById("mobile-user-name");
    if (mobileUserAvatar) {
      mobileUserAvatar.src = APP.currentUser.avatar;
    }
    if (mobileUserName) {
      mobileUserName.textContent = APP.currentUser.displayName;
    }

    // Show auth-required nav links (excluding admin-only which are handled separately)
    authRequiredLinks.forEach(function (link) {
      if (!link.classList.contains("admin-only")) {
        link.style.display = "";
      }
    });

    // Check if user is admin
    const userRoles = APP.currentUser.roles || [];
    const isAdmin = userRoles.includes("ADMIN");

    // Show/hide admin-only elements based on admin status
    adminOnlyElements.forEach(function (el) {
      el.style.display = isAdmin ? "" : "none";
    });

    // Show/hide non-admin-only elements (opposite of admin-only)
    nonAdminOnlyElements.forEach(function (el) {
      el.style.display = isAdmin ? "none" : "";
    });

    // Update display names
    document.querySelectorAll(".user-display-name").forEach(function (el) {
      el.textContent = APP.currentUser.displayName;
    });

    // Update home user name
    const homeUserName = document.getElementById("home-user-name");
    if (homeUserName) {
      homeUserName.textContent = APP.currentUser.displayName;
    }
  } else {
    if (navbarToggle) navbarToggle.style.display = "none";
    // Hide user info
    if (userInfo) userInfo.style.display = "none";

    // Hide auth-required nav links
    authRequiredLinks.forEach(function (link) {
      link.style.display = "none";
    });

    // Hide admin-only elements
    adminOnlyElements.forEach(function (el) {
      el.style.display = "none";
    });

    // Hide non-admin-only elements (only shown for authenticated non-admin users)
    nonAdminOnlyElements.forEach(function (el) {
      el.style.display = "none";
    });
  }
}








