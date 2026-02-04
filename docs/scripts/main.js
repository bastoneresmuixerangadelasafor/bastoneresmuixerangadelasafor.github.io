/**
 * SPA Router and Authentication Manager
 * Handles client-side routing, authentication state, and UI updates
 */

// Global state
const AppState = {
  currentUser: null,
  isAuthenticated: false,
  currentView: null,
  isLoading: true,
  // Store IDs for data that needs to be loaded with the view
  eventIdToLoad: null,
  trainingIdToLoad: null,
  // Track currently loaded IDs to prevent duplicate loading
  currentEventId: null,
  currentTrainingId: null,
};

// Track pending diagram load intervals to prevent stale closures
let pendingDiagramLoadInterval = null;

// Initialize the app when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  initializeApp();
});

/**
 * Initialize dark mode based on browser preference
 */
function initializeDarkMode() {
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

/**
 * Initialize PWA features like service worker
 */
function initializePwa() {
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

/**
 * Initialize the application
 */
function initializeApp() {
  // Initialize dark mode first for immediate theme application
  initializeDarkMode();

  initializePwa();

  showLoading(true);

  // Check authentication status
  API.getCurrentUser()
    .then(function (result) {
      AppState.isAuthenticated = !!result.user;
      AppState.currentUser = result.user;

      initializeRouter();
      initializeEventListeners();
      updateAuthUI();

      showLoading(false);

      const hash = window.location.hash.substring(1);
      const savedRoute = localStorage.getItem("currentRoute");
      // Show login page if not authenticated, otherwise show home or saved route
      const initialRoute = AppState.isAuthenticated
        ? hash || savedRoute || "home"
        : hash || "home-guest";
      // Check if the initial route contains an event ID (e.g., events/eventId)
      if (initialRoute.startsWith("events/")) {
        const eventId = decodeURIComponent(initialRoute.substring(7)); // Remove 'events/' prefix and decode
        if (eventId) {
          AppState.eventIdToLoad = escapeHtml(eventId);
          navigateTo("edit-event", false);
          return;
        }
      }
      // Check if the initial route contains a training ID (e.g., training/trainingId)
      if (initialRoute.startsWith("training/")) {
        const trainingId = decodeURIComponent(initialRoute.substring(9)); // Remove 'training/' prefix and decode
        if (trainingId) {
          AppState.trainingIdToLoad = escapeHtml(trainingId);
          navigateTo("edit-training", false);
          return;
        }
      }
      navigateTo(initialRoute);
    })
    .catch(function (error) {
      console.error("Auth check failed:", error);
      AppState.isAuthenticated = false;

      initializeRouter();
      initializeEventListeners();
      updateAuthUI();

      showLoading(false);

      navigateTo("home-guest");
    });
}

/**
 * Check if currently in edit mode (members page or events page)
 */
function isInEditMode() {
  // Check members edit mode
  if (currentEditingMemberId !== null) {
    return true;
  }
  // Check events dirty state
  if (typeof diagramsIsDirty !== "undefined" && diagramsIsDirty) {
    return true;
  }
  return false;
}

/**
 * Cancel current edit mode (for navigation confirmation)
 */
function cancelCurrentEditMode() {
  // Cancel members inline edit if active
  if (currentEditingMemberId !== null) {
    cancelInlineEdit();
  }
  // Reset events dirty flag
  if (typeof diagramsIsDirty !== "undefined") {
    diagramsIsDirty = false;
  }
}

// Flag to prevent duplicate toasts when restoring hash
var isRestoringHash = false;

/**
 * Initialize the SPA router
 */
function initializeRouter() {
  // Prevent page reload/close when in edit mode
  window.addEventListener("beforeunload", function (e) {
    if (isInEditMode()) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  });

  // Handle browser back/forward buttons
  window.addEventListener("hashchange", function (e) {
    // Skip if we're restoring the hash after blocking navigation
    if (isRestoringHash) {
      isRestoringHash = false;
      return;
    }
    if (isInEditMode()) {
      const route = window.location.hash.substring(1) || "home";
      // Show confirmation dialog like beforeunload does
      if (confirm("Tens canvis sense desar. Vols sortir sense desar?")) {
        // User confirmed, cancel edit and proceed with navigation
        cancelCurrentEditMode();
        // Check if the route contains an event ID (e.g., events/eventId)
        if (route.startsWith("events/")) {
          const eventId = decodeURIComponent(route.substring(7));
          if (eventId) {
            viewEvent(escapeHtml(eventId));
            return;
          }
        }
        navigateTo(route, false);
      } else {
        // User cancelled, restore the hash (use saved route which includes event ID if present)
        isRestoringHash = true;
        const savedRoute =
          localStorage.getItem("currentRoute") || AppState.currentView;
        window.location.hash = savedRoute;
      }
      return;
    }
    const route = window.location.hash.substring(1) || "home";
    
    // Extract IDs from special hash formats (events/id, training/id)
    if (route.startsWith("events/")) {
      const eventId = decodeURIComponent(route.substring(7));
      if (eventId) {
        AppState.eventIdToLoad = escapeHtml(eventId);
        navigateTo("edit-event", false);
        return;
      }
    }
    if (route.startsWith("training/")) {
      const trainingId = decodeURIComponent(route.substring(9));
      if (trainingId) {
        AppState.trainingIdToLoad = escapeHtml(trainingId);
        navigateTo("edit-training", false);
        return;
      }
    }
    
    navigateTo(route, false);
  });
}

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  // Navigation links
  document.querySelectorAll("[data-route]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const route = this.getAttribute("data-route");
      navigateTo(route);
    });
  });

  // Email/Password login form
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleEmailPasswordLogin);
  }

  // Google login button (login view)
  const mailLoginBtn = document.getElementById("mail-login-btn");
  if (mailLoginBtn) {
    mailLoginBtn.addEventListener("click", handleAccessLink);
  }

  // Google login button (guest landing view)
  const mailLoginGuestBtn = document.getElementById("mail-login-btn-guest");
  if (mailLoginGuestBtn) {
    mailLoginGuestBtn.addEventListener("click", handleAccessLink);
  }

  // Register form
  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegisterSubmit);
  }

  // Logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // Mobile logout button
  const mobileLogoutBtn = document.getElementById("mobile-logout-btn");
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener("click", function (e) {
      e.preventDefault();
      document.querySelector(".navbar-menu")?.classList.remove("active");
      handleLogout(e);
    });
  }

  // Mobile nav toggle
  const navbarToggle = document.getElementById("navbar-toggle");
  if (navbarToggle) {
    navbarToggle.addEventListener("click", function () {
      document.querySelector(".navbar-menu").classList.toggle("active");
    });
  }

  // Show profile section when avatar or name is clicked
  // User menu dropdown logic
  const userMenuTrigger = document.querySelector(
    ".user-menu-trigger .member-name",
  );
  const userMenu = document.getElementById("user-menu");
  function toggleUserMenu(e) {
    e.stopPropagation();
    if (userMenu.style.display === "block") {
      userMenu.style.display = "none";
    } else {
      userMenu.style.display = "block";
    }
  }
  if (userMenuTrigger) {
    userMenuTrigger.addEventListener("click", toggleUserMenu);
  }
  // Hide menu when clicking outside
  document.addEventListener("click", function (e) {
    if (
      userMenu &&
      userMenu.style.display === "block" &&
      !userMenu.contains(e.target) &&
      !userMenuTrigger.contains(e.target)
    ) {
      userMenu.style.display = "none";
    }
  });
  // Handle menu item clicks
  if (userMenu) {
    userMenu.querySelectorAll(".user-menu-item").forEach(function (item) {
      item.addEventListener("click", function (e) {
        e.preventDefault();
        userMenu.style.display = "none";
        const view = item.getAttribute("data-menu-view");
        if (view) {
          navigateTo(view);
        }
      });
    });
  }

  // Handle mobile menu navigation items with data-menu-view
  document
    .querySelectorAll(".mobile-user-actions [data-menu-view]")
    .forEach(function (item) {
      item.addEventListener("click", function (e) {
        e.preventDefault();
        document.querySelector(".navbar-menu")?.classList.remove("active");
        const view = item.getAttribute("data-menu-view");
        if (view) {
          navigateTo(view);
        }
      });
    });

  // Add member button
  const addMemberBtn = document.getElementById("add-member-btn");
  if (addMemberBtn) {
    addMemberBtn.addEventListener("click", startAddNewMember);
  }

  // Refresh members button
  const refreshMembersBtn = document.getElementById("refresh-members-btn");
  if (refreshMembersBtn) {
    refreshMembersBtn.addEventListener("click", refreshMembersList);
  }

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

  // Login dialog close button
  const loginCloseBtn = document.getElementById("login-close-btn");
  const loginDialog = document.getElementById("view-login");
  if (loginCloseBtn) {
    loginCloseBtn.addEventListener("click", function () {
      if (loginDialog) {
        loginDialog.close();
      }
    });
  }

  // Close login dialog when clicking on backdrop
  if (loginDialog) {
    loginDialog.addEventListener("click", function (e) {
      if (e.target === this) {
        this.close();
      }
    });
  }

  // Signup link in login dialog - close dialog and show register
  const signupLink = document.getElementById("signup-link");
  if (signupLink) {
    signupLink.addEventListener("click", function (e) {
      e.preventDefault();
      const loginDialog = document.getElementById("view-login");
      if (loginDialog) {
        loginDialog.close();
      }
      navigateTo("register");
    });
  }

  // Register dialog close button
  const registerCloseBtn = document.getElementById("register-close-btn");
  const registerDialog = document.getElementById("view-register");
  if (registerCloseBtn) {
    registerCloseBtn.addEventListener("click", function () {
      if (registerDialog) {
        registerDialog.close();
      }
    });
  }

  // Close register dialog when clicking on backdrop
  if (registerDialog) {
    registerDialog.addEventListener("click", function (e) {
      if (e.target === this) {
        this.close();
      }
    });
  }

  // Dance audio dialog close button
  const danceAudioCloseBtn = document.getElementById("dance-audio-close-btn");
  const danceAudioDialog = document.getElementById("dance-audio-dialog");
  if (danceAudioCloseBtn) {
    danceAudioCloseBtn.addEventListener("click", function () {
      if (danceAudioDialog) {
        danceAudioDialog.close();
      }
    });
  }

  // Close dance audio dialog when clicking on backdrop
  if (danceAudioDialog) {
    danceAudioDialog.addEventListener("click", function (e) {
      if (e.target === this) {
        this.close();
      }
    });

    // Stop all audio when dialog closes
    danceAudioDialog.addEventListener("close", function () {
      stopAllAudioInDialog(danceAudioDialog);
    });
  }

  // Login link in register dialog - close register and show login
  const loginLink = document.getElementById("login-link");
  if (loginLink) {
    loginLink.addEventListener("click", function (e) {
      e.preventDefault();
      if (registerDialog) {
        registerDialog.close();
      }
      navigateTo("login");
    });
  }
}

/**
 * Navigate to a route
 * @param {string} route - Route name
 * @param {boolean} updateHash - Whether to update URL hash
 */
function navigateTo(route, updateHash = true) {
  const originalRoute = route; // Track original route for hash updates

  // Handle login as a modal dialog instead of navigation
  if (route === "login") {
    closeAllDialogs();
    const loginDialog = document.getElementById("view-login");
    if (loginDialog) {
      loginDialog.showModal();
    }
    return;
  }

  // Handle register as a modal dialog instead of navigation
  if (route === "register") {
    closeAllDialogs();
    const registerDialog = document.getElementById("view-register");
    if (registerDialog) {
      registerDialog.showModal();
    }
    return;
  }

  // Prevent navigation when in edit mode
  if (isInEditMode() && route !== AppState.currentView) {
    // Show confirmation dialog like beforeunload does
    if (confirm("Tens canvis sense desar. Vols sortir sense desar?")) {
      // User confirmed, cancel edit and proceed with navigation
      cancelCurrentEditMode();
    } else {
      // User cancelled, stay on current view
      return;
    }
  }

  const baseRoute = route.split("/")[0];
  const view = document.querySelector(`[data-view="${baseRoute}"]`);

  if (!view) {
    route = "404";
  } else if (AppState.isAuthenticated) {
    // Logged-in user: redirect from guest pages to home
    if (
      baseRoute === "login" ||
      baseRoute === "register" ||
      baseRoute === "home-guest"
    ) {
      route = "home";
    }
  } else {
    // Guest user: check if route is public
    const publicRoutes = ["home-guest", "login", "register"];
    if (baseRoute === "home") {
      route = "home-guest";
    } else if (!publicRoutes.includes(baseRoute)) {
      showToast(
        "Has de iniciar sessió per accedir a aquesta pàgina",
        "warning",
      );
      route = "home-guest";
    }
  }

  // Skip if already on this route (prevents duplicate data loading)
  const alreadyOnRoute = AppState.currentView === route;

  // Hide all views
  document.querySelectorAll(".view").forEach(function (v) {
    v.style.display = "none";
    v.classList.remove("active");
  });

  // Show target view
  const finalView = document.querySelector(`[data-view="${route}"]`);
  if (finalView) {
    finalView.style.display = "block";
    finalView.classList.add("active");
  }

  // Show/hide floating-lock-btn based on current view
  const floatingLockBtn = document.getElementById("floating-lock-btn");
  if (floatingLockBtn) {
    floatingLockBtn.style.display = route === "planning-event" ? "flex" : "none";
  }

  // Reset isEventEditable when leaving planning-event view
  if (route !== "planning-event" && typeof isEventEditable !== "undefined") {
    isEventEditable = false;
    isEventManuallyUnlocked = false;
  }

  // Update active nav link
  document.querySelectorAll(".nav-link").forEach(function (link) {
    link.classList.remove("active");
    if (link.getAttribute("data-route") === route) {
      link.classList.add("active");
    }
  });

  // Update hash if it was changed by parameter or if the route was forced
  const routeWasForced = originalRoute !== route;
  if (updateHash || routeWasForced) {
    window.location.hash = route;
  }

  AppState.currentView = route;

  // Save current route to localStorage for persistence across refreshes
  // Don't persist 404 page as it's typically server-forced
  if (route !== "404") {
    localStorage.setItem("currentRoute", route);
  }

  // Load view-specific data only if navigating to a new route
  // OR if we have an ID to load (for event/training details)
  if (!alreadyOnRoute || AppState.eventIdToLoad || AppState.trainingIdToLoad) {
    loadViewData(route);
  }

  // Close mobile menu
  document.querySelector(".navbar-menu")?.classList.remove("active");

  // Scroll to top
  window.scrollTo(0, 0);
}

/**
 * Close all open dialogs to prevent overlapping
 */
function closeAllDialogs() {
  const dialogs = document.querySelectorAll('dialog[open]');
  dialogs.forEach(function (dialog) {
    if (dialog) dialog.close();
  });
}

/**
 * Load data specific to a view
 * @param {string} view - View name
 */
function loadViewData(view) {
  switch (view) {
    case "home":
      loadHomeData();
      break;
    case "dashboard":
      loadDashboardData();
      break;
    case "profile":
      loadProfileData();
      break;
    case "members":
      loadMembersData();
      break;
    case "edit-event":
      if (!membersData || membersData.length === 0) {
        loadMembersDataForEvents();
      }
      // Load event data if ID is stored
      if (AppState.eventIdToLoad) {
        loadEventData(AppState.eventIdToLoad);
        AppState.eventIdToLoad = null;
      } else {
        resetEventsForm();
      }
      break;
    case "edit-training":
      // Load training data if ID is stored
      if (AppState.trainingIdToLoad) {
        loadTrainingData(AppState.trainingIdToLoad);
        AppState.trainingIdToLoad = null;
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

/**
 * Reset the events form to empty state for creating a new event
 */
function resetEventsForm() {
  // Clear event name, datetime and meeting place inputs
  const eventNameInput = document.getElementById("event-name-input");
  const eventDatetimeInput = document.getElementById("event-datetime-input");
  const eventMeetingPlaceInput = document.getElementById(
    "event-meeting-place-input",
  );

  if (eventNameInput) {
    eventNameInput.value = "";
  }

  if (eventDatetimeInput) {
    eventDatetimeInput.value = "";
  }

  if (eventMeetingPlaceInput) {
    eventMeetingPlaceInput.value = "";
  }

  // Hide dance selector section
  const danceSelectorSection = document.getElementById(
    "dance-selector-section",
  );
  if (danceSelectorSection) {
    danceSelectorSection.style.display = "none";
  }

  // Clear diagrams list
  const diagramsList = document.getElementById("diagrams-list");
  if (diagramsList) {
    diagramsList.innerHTML = "";
  }

  // Reset diagrams array (defined in events.html)
  if (typeof diagrams !== "undefined") {
    diagrams.length = 0;
  }
  if (typeof diagramIdCounter !== "undefined") {
    diagramIdCounter = 0;
  }

  // Reset dirty flag
  if (typeof diagramsIsDirty !== "undefined") {
    diagramsIsDirty = false;
  }
}

/**
 * Reset the training form to empty state for creating a new training
 */
function resetTrainingForm() {
  // Clear training inputs
  const trainingDatetimeInput = document.getElementById("training-datetime-input");
  const trainingDescriptionInput = document.getElementById("training-description-input");

  if (trainingDatetimeInput) {
    trainingDatetimeInput.value = "";
  }

  if (trainingDescriptionInput) {
    trainingDescriptionInput.value = "";
    // Hide detected dances section when form is reset
    const trainingDetectedDancesSection = document.getElementById("training-detected-dances-section");
    if (trainingDetectedDancesSection) {
      trainingDetectedDancesSection.style.display = "none";
    }
  }

  // Update page header to "Nou assaig"
  updateTrainingPageTitle(false);

  // Apply editable state (admin-only)
  applyTrainingEditableState();

  // Initialize form event listeners for dance detection
  initializeTrainingFormListeners();
}

/**
 * Load events list for planning view
 */
function loadPlanningEventData() {
  const container = document.getElementById("planning-event-list");
  if (!container) return;

  // Show loading state
  container.innerHTML = `
        <div class="events-loading">
        <div class="spinner"></div>
        <span>Carregant actuacions...</span>
        </div>
    `;

  API.getEvents()
    .then(function (events) {
      renderPlanningEventsList(events);
    })
    .catch(function (error) {
      console.error("Failed to load events:", error);
      container.innerHTML = `
                <div class="events-empty">
                <div class="events-empty-icon">⚠️</div>
                <p>No s'han pogut carregar les actuacions</p>
                </div>
            `;
    });
}

function loadPlanningTrainingData() {
  const container = document.getElementById("planning-training-list");
  if (!container) return;

  // Show loading state
  container.innerHTML = `
        <div class="training-loading">
        <div class="spinner"></div>
        <span>Carregant assajos...</span>
        </div>
    `;

  API.getTrainings()
    .then(function (events) {
      renderPlanningTrainingsList(events);
    })
    .catch(function (error) {
      console.error("Failed to load training sessions:", error);
      container.innerHTML = `
                <div class="training-empty">
                <div class="training-empty-icon">⚠️</div>
                <p>No s'han pogut carregar els assajos</p>
                </div>
            `;
    });
}

/**
 * Render the events list in planning view
 * @param {Array} events - Array of event objects
 */
function renderPlanningEventsList(events) {
  const container = document.getElementById("planning-event-list");
  const pastEventsContainer = document.getElementById("past-event-list");
  const pastEventsToggle = document.getElementById("past-event-toggle");
  const pastEventsCount = document.getElementById("past-event-count");

  if (!container) return;

  if (!events || events.length === 0) {
    container.innerHTML = `
    <div class="events-empty">
    <div class="events-empty-icon">📅</div>
    <p>No hi ha actuacions programades</p>
    <p>Crea un nou assaig o actuació per començar!</p>
    </div>
    `;
    if (pastEventsContainer) pastEventsContainer.innerHTML = "";
    return;
  }

  const now = new Date();
  const upcomingEvents = [];
  const pastEvents = [];

  // Separate upcoming and past events
  events.forEach(function (event) {
    if (event.date) {
      const eventDate = new Date(event.date);
      if (eventDate < now) {
        pastEvents.push(event);
      } else {
        upcomingEvents.push(event);
      }
    } else {
      upcomingEvents.push(event);
    }
  });

  // Helper function to create event card HTML
  function createEventCardHTML(event) {
    const formattedDate = formatEventDate(event.date);
    let meetingPlaceHtml = "";
    if (event.meetingPlace) {
      if (event.placeUrl) {
        meetingPlaceHtml = `<a href="${escapeHtml(event.placeUrl)}" target="_blank" class="event-card-place">📍 ${escapeHtml(event.meetingPlace)}</a>`;
      } else {
        meetingPlaceHtml = `<span class="event-card-place">📍 ${escapeHtml(event.meetingPlace)}</span>`;
      }
    }
    const isAdmin = AppState.currentUser && (AppState.currentUser.roles || []).includes("ADMIN");
    const actionHtml = event.confirmed || isAdmin
      ? `<button type="button" class="event-card-btn view-btn" onclick="viewEvent('${escapeHtml(event.id)}')">Detalls</button>`
      : `<span class="event-tbc" style="font-style: italic; color: var(--text-secondary, #666);">TBC</span>`;
    return `
    <div class="event-card" data-event-id="${event.id}">
    <div class="event-card-info">
    <span class="event-card-name">${event.name}</span>
    <span class="event-card-date">${formattedDate}</span>
    ${meetingPlaceHtml}
    </div>
    <div class="event-card-actions">
    ${actionHtml}
    </div>
    </div>
    `;
  }

  // Render upcoming events
  if (upcomingEvents.length === 0) {
    container.innerHTML = `
    <div class="events-empty">
    <div class="events-empty-icon">📅</div>
    <p>No hi ha actuacions programades</p>
    <p>Crea un nou assaig o actuació per començar!</p>
    </div>
    `;
  } else {
    // Sort upcoming events by date ascending (closest first)
    upcomingEvents.sort(function (a, b) {
      const dateA = a.date ? new Date(a.date).getTime() : Infinity;
      const dateB = b.date ? new Date(b.date).getTime() : Infinity;
      return dateA - dateB;
    });

    const upcomingHTML = upcomingEvents.map(createEventCardHTML).join("");
    container.innerHTML = upcomingHTML;
  }

  // Render past events in collapsible
  if (pastEventsContainer) {
    if (pastEvents.length === 0) {
      pastEventsContainer.innerHTML =
        '<div class="past-event-empty">No hi ha actuacions passades</div>';
    } else {
      const pastHTML = pastEvents.map(createEventCardHTML).join("");
      pastEventsContainer.innerHTML = pastHTML;
    }
  }

  // Update past events count
  if (pastEventsCount) {
    pastEventsCount.textContent = pastEvents.length;
  }

  // Hide past events section if no past events
  if (pastEventsToggle) {
    if (pastEvents.length === 0) {
      pastEventsToggle.style.display = "none";
    } else {
      pastEventsToggle.style.display = "flex";
    }
  }

  // Initialize collapsible toggle listener
  if (pastEventsToggle && !pastEventsToggle.dataset.initialized) {
    pastEventsToggle.addEventListener("click", function () {
      const content = pastEventsContainer;
      pastEventsToggle.classList.toggle("active");
      if (content.style.display === "none") {
        content.style.display = "flex";
      } else {
        content.style.display = "none";
      }
    });
    pastEventsToggle.dataset.initialized = "true";
  }

  // Show refresh button after content is rendered
  const refreshBtn = document.getElementById("refresh-event-btn");
  if (refreshBtn) {
    refreshBtn.style.display = "block";
  }
}

function renderPlanningTrainingsList(trainings) {
  const container = document.getElementById("planning-training-list");
  const pastTrainingsContainer = document.getElementById("past-training-list");
  const pastTrainingsToggle = document.getElementById("past-training-toggle");
  const pastTrainingsCount = document.getElementById("past-training-count");

  if (!container) return;

  if (!trainings || trainings.length === 0) {
    container.innerHTML = `
    <div class="trainings-empty">
    <div class="trainings-empty-icon">🎓</div>
    <p>No hi ha assajos programats</p>
    <p>Crea un nou assaig per començar!</p>
    </div>
    `;
    if (pastTrainingsContainer) pastTrainingsContainer.innerHTML = "";
    return;
  }

  const now = new Date();
  const upcomingTrainings = [];
  const pastTrainings = [];

  // Separate upcoming and past trainings
  trainings.forEach(function (training) {
    if (training.date) {
      const trainingDate = new Date(training.date);
      if (trainingDate >= now) {
        upcomingTrainings.push(training);
      } else {
        pastTrainings.push(training);
      }
    } else {
      upcomingTrainings.push(training);
    }
  });

  // Helper function to create training card HTML
  function createTrainingCardHTML(training) {
    const formattedDate = formatEventDate(training.date);
    let meetingPlaceHtml = "";
    if (training.meetingPlace) {
      meetingPlaceHtml = `<span class="training-card-location">📍 ${escapeHtml(training.meetingPlace)}</span>`;
    }
    const actionHtml = `
      <div class="training-card-action-group">
        <button type="button" class="btn btn-sm btn-primary" onclick="navigateToTraining('${escapeHtml(training.id)}')">Detalls</button>
      </div>
    `;
    return `
<div class="training-card" data-training-id="${training.id}">
<div class="training-card-info">
    <span class="training-card-name">${escapeHtml(training.name)}</span>
    <span class="training-card-date">${formattedDate}</span>
    <span class="training-count">${training.assistance ? training.assistance.length : 0} persones apuntades</span>
    ${meetingPlaceHtml}
</div>
<div class="training-card-actions">
    ${actionHtml}
</div>
</div>
`;
  }

  // Render upcoming trainings
  if (upcomingTrainings.length === 0) {
    container.innerHTML = `
<div class="trainings-empty">
<div class="trainings-empty-icon">🎓</div>
<p>No hi ha assajos programats</p>
<p>Crea un nou assaig per començar!</p>
</div>
`;
  } else {
    // Sort upcoming trainings by date ascending (closest first)
    upcomingTrainings.sort(function (a, b) {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });

    const upcomingHTML = upcomingTrainings.map(createTrainingCardHTML).join("");
    container.innerHTML = upcomingHTML;
  }

  // Render past trainings in collapsible
  if (pastTrainingsContainer) {
    if (pastTrainings.length === 0) {
      pastTrainingsContainer.innerHTML = '<div class="past-training-empty">No hi ha assajos passats</div>';
    } else {
      const pastHTML = pastTrainings.map(createTrainingCardHTML).join("");
      pastTrainingsContainer.innerHTML = pastHTML;
    }
  }

  // Update past trainings count
  if (pastTrainingsCount) {
    pastTrainingsCount.textContent = pastTrainings.length;
  }

  // Hide past trainings section if no past trainings
  if (pastTrainingsToggle) {
    if (pastTrainings.length === 0) {
      pastTrainingsToggle.style.display = "none";
    } else {
      pastTrainingsToggle.style.display = "flex";
    }
  }

  // Initialize collapsible toggle listener
  if (pastTrainingsToggle && !pastTrainingsToggle.dataset.initialized) {
    pastTrainingsToggle.addEventListener("click", function () {
      const content = pastTrainingsContainer;
      pastTrainingsToggle.classList.toggle("active");
      if (content.style.display === "none") {
        content.style.display = "flex";
      } else {
        content.style.display = "none";
      }
    });
    pastTrainingsToggle.dataset.initialized = "true";
  }

  // Show refresh button after content is rendered
  const refreshBtn = document.getElementById("refresh-training-btn");
  if (refreshBtn) {
    refreshBtn.style.display = "block";
  }
}

/**
 * Format event date for display
 * @param {string|Date} date - Date to format (expects ISO format)
 * @returns {string} Formatted date string in Catalan
 */
function formatEventDate(date) {
  if (!date) return "Data no especificada";

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);

    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return d.toLocaleDateString("ca-ES", options);
  } catch (e) {
    return String(date);
  }
}

// Data loading functions are now separate from navigation

/**
 * Load event data into edit-event view
 * @param {string} eventId - Event ID to load
 */
function loadEventData(eventId) {
  if (!eventId) {
    showToast("ID d'desenvolupament no vàlid", "error");
    return;
  }

  // Prevent loading the same event multiple times
  if (AppState.currentEventId === eventId) {
    return;
  }
  
  AppState.currentEventId = eventId;

  // Set flag to prevent form reset when navigating
  isLoadingExistingEvent = true;
  
  showLoading(true);

  API.getEventById({ eventId })
    .then(function (eventData) {
      showLoading(false);

      if (!eventData) {
        showToast("No s'ha trobat l'esdeveniment", "error");
        isLoadingEventFromHash = false;
        return;
      }

      // Navigate to events view with event ID in hash
      // Use eventData.id (returned from server) as the canonical ID
      const canonicalEventId = eventData.id || eventId;
      const eventHash = "events/" + encodeURIComponent(canonicalEventId);
      localStorage.setItem("currentRoute", eventHash);

      // Populate event fields (admin inputs)
      const eventNameInput = document.getElementById("event-name-input");
      const eventDatetimeInput = document.getElementById(
        "event-datetime-input",
      );
      const eventMeetingPlaceInput = document.getElementById(
        "event-meeting-place-input",
      );
      // Populate display elements (non-admin)
      const eventNameDisplay = document.getElementById("event-name-display");
      const eventDateDisplay = document.getElementById("event-date-display");
      const eventMeetingPlaceDisplay = document.getElementById(
        "event-meeting-place-display",
      );

      if (eventNameInput) {
        eventNameInput.value = eventData.name || "";
      }
      if (eventNameDisplay) {
        eventNameDisplay.textContent = eventData.name || "";
      }

      if (eventDatetimeInput && eventData.datetime) {
        // Date should already be in datetime-local format (YYYY-MM-DDTHH:mm)
        // or ISO format that needs conversion
        try {
          let dateValue = eventData.datetime;
          // If it's an ISO string (contains Z or timezone offset), convert to local
          if (dateValue.includes("Z") || dateValue.match(/[+-]\d{2}:\d{2}$/)) {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, "0");
              const day = String(date.getDate()).padStart(2, "0");
              const hours = String(date.getHours()).padStart(2, "0");
              const minutes = String(date.getMinutes()).padStart(2, "0");
              dateValue = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
          }
          eventDatetimeInput.value = dateValue;

          // Format date for display (non-admin)
          if (eventDateDisplay && dateValue) {
            const displayDate = new Date(dateValue);
            if (!isNaN(displayDate.getTime())) {
              const options = {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              };
              eventDateDisplay.textContent = displayDate.toLocaleDateString(
                "ca-ES",
                options,
              );
            }
          }
        } catch (e) {
          console.error("Error parsing event date:", e);
        }
      }

      // Populate meeting place
      if (eventMeetingPlaceInput) {
        eventMeetingPlaceInput.value = eventData.meetingPlace || "";
      }
      if (eventMeetingPlaceDisplay) {
        eventMeetingPlaceDisplay.textContent = eventData.meetingPlace || "";
      }

      // Trigger input events to show dance selector
      eventNameInput.dispatchEvent(new Event("input"));
      eventDatetimeInput.dispatchEvent(new Event("input"));

      // Load diagrams after a short delay to ensure dances data is loaded
      setTimeout(function () {
        loadEventDiagrams(eventData);
        // Clear flag after diagrams are loaded to allow subsequent hash changes
        isLoadingEventFromHash = false;
      }, 500);

      showToast("Esdeveniment carregat", "success");
    })
    .catch(function (error) {
      showLoading(false);
      console.error("Error loading event:", error);
      showToast("Error carregant l'esdeveniment", "error");
      // Clear flag on error
      isLoadingEventFromHash = false;
    });
}

/**
 * Quick navigate to event (backward compatibility)
 */
function viewEvent(eventId) {
  if (!eventId) return;
  AppState.eventIdToLoad = escapeHtml(eventId);
  window.location.hash = "events/" + encodeURIComponent(eventId);
}

/**
 * Load training data into edit-training view
 * @param {string} trainingId - Training ID to load
 */
function loadTrainingData(trainingId) {
  if (!trainingId) {
    showToast("ID d'assaig no vàlid", "error");
    return;
  }

  // Prevent loading the same training multiple times
  if (AppState.currentTrainingId === trainingId) {
    return;
  }
  
  AppState.currentTrainingId = trainingId;

  showLoading(true);

  API.getTrainingById({ trainingId })
    .then(function (trainingData) {
      showLoading(false);

      if (!trainingData) {
        showToast("No s'ha trobat l'assaig", "error");
        isLoadingTrainingFromHash = false;
        return;
      }

      // Navigate to edit-training view with training ID in hash
      const canonicalTrainingId = trainingData.id || trainingId;
      const trainingHash = "training/" + encodeURIComponent(canonicalTrainingId);
      localStorage.setItem("currentRoute", trainingHash);
      // Note: hash is already set by navigateToTraining(), don't set it again
      // window.location.hash = trainingHash;

      // Populate training fields
      const trainingDatetimeInput = document.getElementById(
        "training-datetime-input",
      );
      const trainingDescriptionInput = document.getElementById(
        "training-description-input",
      );

      if (trainingDatetimeInput && trainingData.date) {
        try {
          let dateValue = trainingData.date;
          // If it's an ISO string (contains Z or timezone offset), convert to local
          if (dateValue.includes("Z") || dateValue.match(/[+-]\d{2}:\d{2}$/)) {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, "0");
              const day = String(date.getDate()).padStart(2, "0");
              const hours = String(date.getHours()).padStart(2, "0");
              const minutes = String(date.getMinutes()).padStart(2, "0");
              dateValue = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
          }
          trainingDatetimeInput.value = dateValue;
        } catch (e) {
          console.error("Error parsing training date:", e);
        }
      }

      if (trainingDescriptionInput && trainingData.description) {
        trainingDescriptionInput.value = trainingData.description;
        // Detect dances from the loaded description
        detectAndDisplayDancesFromDescription();
      }

      // Update page header to "Assaig" (editing mode)
      updateTrainingPageTitle(true);

      // Apply editable state based on admin role
      applyTrainingEditableState();

      // Initialize form event listeners for dance detection
      initializeTrainingFormListeners();

      // Clear flag after loading completes
      isLoadingTrainingFromHash = false;

      showToast("Assaig carregat", "success");
    })
    .catch(function (error) {
      showLoading(false);
      console.error("Error loading training:", error);
      showToast("Error carregant l'assaig", "error");
    });
}

/**
 * Apply editable state to training fields based on user role
 * Only admins can edit training details
 */
function applyTrainingEditableState() {
  const isAdmin = AppState.currentUser && (AppState.currentUser.roles || []).includes("ADMIN");
  
  const trainingDatetimeInput = document.getElementById("training-datetime-input");
  const trainingDescriptionInput = document.getElementById("training-description-input");
  const trainingDatetimeLabel = document.getElementById("training-datetime-label");
  const trainingDescriptionLabel = document.getElementById("training-description-label");
  const saveBtnTraining = document.getElementById("floating-save-training-btn");

  if (isAdmin) {
    // Show inputs, hide labels
    if (trainingDatetimeInput) trainingDatetimeInput.style.display = "";
    if (trainingDescriptionInput) trainingDescriptionInput.style.display = "";
    if (trainingDatetimeLabel) trainingDatetimeLabel.style.display = "none";
    if (trainingDescriptionLabel) trainingDescriptionLabel.style.display = "none";
    if (saveBtnTraining) saveBtnTraining.style.display = "";
    
    // Enable fields
    if (trainingDatetimeInput) trainingDatetimeInput.disabled = false;
    if (trainingDescriptionInput) trainingDescriptionInput.disabled = false;
  } else {
    // Show labels, hide inputs
    if (trainingDatetimeInput) trainingDatetimeInput.style.display = "none";
    if (trainingDescriptionInput) trainingDescriptionInput.style.display = "none";
    if (trainingDatetimeLabel) trainingDatetimeLabel.style.display = "";
    if (trainingDescriptionLabel) trainingDescriptionLabel.style.display = "";
    if (saveBtnTraining) saveBtnTraining.style.display = "none";
    
    // Disable fields
    if (trainingDatetimeInput) trainingDatetimeInput.disabled = true;
    if (trainingDescriptionInput) trainingDescriptionInput.disabled = true;
    
    // Populate labels with current values
    if (trainingDatetimeLabel && trainingDatetimeInput && trainingDatetimeInput.value) {
      const dateObj = new Date(trainingDatetimeInput.value + ":00");
      const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      };
      trainingDatetimeLabel.textContent = dateObj.toLocaleDateString("ca-ES", options);
    }
    
    if (trainingDescriptionLabel && trainingDescriptionInput && trainingDescriptionInput.value) {
      trainingDescriptionLabel.textContent = trainingDescriptionInput.value;
    }
  }
}

/**
 * Update training page title based on edit/create mode
 * @param {boolean} isEditing - True if editing existing training, false if creating new one
 */
function updateTrainingPageTitle(isEditing) {
  const pageHeader = document.querySelector("#view-training .page-header h1");
  if (pageHeader) {
    pageHeader.textContent = isEditing ? "Assaig" : "Nou assaig";
  }
}

/**
 * Detect dances from training description and update chips display
 */
function detectAndDisplayDancesFromDescription() {
  const trainingDescriptionInput = document.getElementById("training-description-input");
  const trainingDetectedDancesSection = document.getElementById("training-detected-dances-section");
  const trainingDetectedDancesChips = document.getElementById("training-detected-dances");

  if (!trainingDescriptionInput || !trainingDetectedDancesSection || !trainingDetectedDancesChips) {
    return;
  }

  const description = trainingDescriptionInput.value.toLowerCase().trim();

  // If description is empty, hide the section
  if (!description) {
    trainingDetectedDancesSection.style.display = "none";
    return;
  }

  // Detect dances from description
  const detectedDances = detectDancesFromText(description);

  if (detectedDances.length === 0) {
    trainingDetectedDancesSection.style.display = "none";
    return;
  }

  // Show the section and populate chips
  trainingDetectedDancesSection.style.display = "flex";
  trainingDetectedDancesChips.innerHTML = "";

  detectedDances.forEach(function (danceName) {
    const chip = document.createElement("div");
    chip.className = "training-detected-dance-chip";
    chip.textContent = danceName;
    chip.addEventListener("click", function () {
      openDanceAudioDialog(danceName);
    });
    trainingDetectedDancesChips.appendChild(chip);
  });
}

/**
 * Detect dance names from text by checking against available dances
 * @param {string} text - The text to search for dance names
 * @returns {Array<string>} Array of detected dance names
 */
function detectDancesFromText(text) {
  if (!text || typeof dancesData === "undefined" || !Array.isArray(dancesData)) {
    return [];
  }

  const detectedDances = [];
  const seenNames = new Set();

  // Search for each dance name in the text
  dancesData.forEach(function (dance) {
    if (dance.name && !seenNames.has(dance.name)) {
      const danceName = dance.name.toLowerCase();
      // Case-insensitive search for the dance name
      if (text.includes(danceName)) {
        detectedDances.push(dance.name);
        seenNames.add(dance.name);
      }
    }
  });

  return detectedDances;
}

/**
 * Initialize training form event listeners for dance detection
 */
function initializeTrainingFormListeners() {
  const trainingDescriptionInput = document.getElementById("training-description-input");
  
  if (!trainingDescriptionInput) {
    return;
  }

  // Remove any existing listeners to avoid duplicates
  const newInput = trainingDescriptionInput.cloneNode(true);
  trainingDescriptionInput.parentNode.replaceChild(newInput, trainingDescriptionInput);

  // Add input event listener to detect dances as description changes
  newInput.addEventListener("input", detectAndDisplayDancesFromDescription);
}

/**
 * Open dialog showing dance audio information
 * @param {string} danceName - The name of the dance to display audios for
 */
function openDanceAudioDialog(danceName) {
  if (!danceName || typeof dancesData === "undefined") {
    return;
  }

  // Find the dance data
  const dance = dancesData.find(function (d) {
    return d.name === danceName;
  });

  if (!dance) {
    return;
  }

  const dialog = document.getElementById("dance-audio-dialog");
  const titleElement = document.getElementById("dance-audio-title");
  const audioListElement = document.getElementById("dance-audio-list");

  if (!dialog || !titleElement || !audioListElement) {
    return;
  }

  // Set the title
  titleElement.textContent = danceName;

  // Clear and populate audio list
  audioListElement.innerHTML = "";

  if (!dance.audios || dance.audios.length === 0) {
    audioListElement.innerHTML = '<div class="dance-audio-empty">No hi ha audios disponibles per a aquest ball.</div>';
    dialog.showModal();
    return;
  }

  // Create audio items
  dance.audios.forEach(function (audio) {
    const audioItem = document.createElement("div");
    audioItem.className = "dance-audio-item";

    const titleDiv = document.createElement("div");
    titleDiv.className = "dance-audio-item-title";
    titleDiv.textContent = audio.title || "Sense títol";

    const artistDiv = document.createElement("div");
    artistDiv.className = "dance-audio-item-artist";
    artistDiv.textContent = "Per: " + (audio.artist || "Desconegut");

    // Create a container for the player (button initially, iframe on click)
    const playerContainer = document.createElement("div");
    playerContainer.className = "dance-audio-player-container";

    // Create play button
    const playButton = document.createElement("button");
    playButton.className = "dance-audio-play-btn";
    playButton.type = "button";
    playButton.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>';
    playButton.title = "Reproduir àudio";

    // Add click handler to replace button with iframe
    playButton.addEventListener("click", function () {
      playButton.style.display = "none";

      // Show loading state
      const loadingDiv = document.createElement("div");
      loadingDiv.className = "dance-audio-loading";
      loadingDiv.innerHTML = '<div class="spinner"></div><span>Carregant àudio...</span>';
      playerContainer.appendChild(loadingDiv);

      // Request audio data from API
      API.getAudioById({ audioId: audio.fileId })
      .then(function (result) {
        loadingDiv.remove();
        if (result && result.audioData) {
          // Create audio element only on success
          const audioElement = document.createElement("audio");
          audioElement.controls = true;
          audioElement.style.width = "100%";
          audioElement.src = result.audioData;
          playerContainer.appendChild(audioElement);
        } else {
          const errorDiv = document.createElement("div");
          errorDiv.className = "dance-audio-error";
          errorDiv.textContent = "No s'ha pogut carregar l'àudio";
          playerContainer.appendChild(errorDiv);
        }
      })
      .catch(function (error) {
        loadingDiv.remove();
        const errorDiv = document.createElement("div");
        errorDiv.className = "dance-audio-error";
        errorDiv.textContent = error || "Error carregant l'àudio";
        playerContainer.appendChild(errorDiv);
      });
    });

    playerContainer.appendChild(playButton);

    audioItem.appendChild(titleDiv);
    audioItem.appendChild(artistDiv);
    audioItem.appendChild(playerContainer);
    audioListElement.appendChild(audioItem);
  });

  // Show the dialog
  dialog.showModal();
}

/**
 * Stop all audio elements in the dialog
 * @param {HTMLElement} dialogElement - The dialog element containing audio elements
 */
function stopAllAudioInDialog(dialogElement) {
  if (!dialogElement) return;
  
  const audioElements = dialogElement.querySelectorAll("audio");
  audioElements.forEach(function (audio) {
    audio.pause();
    audio.currentTime = 0;
  });
}

/**
 * Close dance audio dialog
 */
function closeDanceAudioDialog() {
  const dialog = document.getElementById("dance-audio-dialog");
  if (dialog && dialog.open) {
    stopAllAudioInDialog(dialog);
    dialog.close();
  }
}

/**
 * Quick navigate to training (backward compatibility)
 */
function navigateToTraining(trainingId) {
  if (!trainingId) return;
  AppState.trainingIdToLoad = escapeHtml(trainingId);
  window.location.hash = "training/" + encodeURIComponent(trainingId);
}

/**
 * Load diagrams from event data into the events view
 * @param {Object} eventData - The event data with diagrams
 */
function loadEventDiagrams(eventData) {
  if (!eventData || !eventData.diagrams) return;

  const diagramsList = document.getElementById("diagrams-list");
  if (!diagramsList) return;

  // Clear any existing pending diagram load interval
  if (pendingDiagramLoadInterval !== null) {
    clearInterval(pendingDiagramLoadInterval);
    pendingDiagramLoadInterval = null;
  }

  // Clear existing diagrams
  diagramsList.innerHTML = "";

  // Reset diagrams array (this is defined in events.html)
  if (typeof diagrams !== "undefined") {
    diagrams.length = 0;
    diagramIdCounter = 0;
  }

  // Function to render diagrams once dances data is available
  function renderDiagrams() {
    if (typeof dancesData === "undefined" || !Array.isArray(dancesData) || dancesData.length === 0) {
      return false;
    }

    eventData.diagrams.forEach(function (diagramData) {
      // Find the dance info to get colors and other metadata
      const danceInfo = dancesData.find(function (d) {
        return d.name === diagramData.danceName;
      });

      const newDiagram = {
        id: diagramIdCounter++,
        danceName: diagramData.danceName,
        description: diagramData.description || "",
        rows: diagramData.rows || 2,
        columns: diagramData.columns || 2,
        positions: diagramData.positions || [],
        diagram: danceInfo
          ? danceInfo.diagram
          : { backgroundColor: {}, textColor: {} },
        groups: diagramData.groups || [],
      };

      // If positions don't have colors, try to get them from dance info
      if (danceInfo && danceInfo.positions) {
        newDiagram.positions = danceInfo.positions;
      }

      diagrams.push(newDiagram);

      const element = createDiagramElement(newDiagram);
      diagramsList.appendChild(element);

      // Setup canvas click handler
      const canvas = document.getElementById(
        "diagram-canvas-" + newDiagram.id,
      );
      if (canvas) {
        setupCanvasClickHandlerForDiagram(newDiagram.id);
      }

      drawDiagram(newDiagram);
    });

    // Mark as not dirty since we just loaded
    if (typeof diagramsIsDirty !== "undefined") {
      diagramsIsDirty = false;
    }

    // Apply editability state to hide diagram-header-actions and floating-save-btn when event is not editable
    if (typeof applyEditableState !== "undefined") {
      applyEditableState();
    }

    return true;
  }

  // Try to render immediately if dances are already loaded
  if (renderDiagrams()) {
    return;
  }

  // Wait for dances data to be available
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds with 100ms intervals
  pendingDiagramLoadInterval = setInterval(function () {
    attempts++;
    
    if (renderDiagrams()) {
      clearInterval(pendingDiagramLoadInterval);
      pendingDiagramLoadInterval = null;
    } else if (attempts >= maxAttempts) {
      clearInterval(pendingDiagramLoadInterval);
      pendingDiagramLoadInterval = null;
      console.warn("Failed to load dances data within timeout");
    }
  }, 100);
}

/**
 * Setup canvas click handler for a loaded diagram
 * This wraps the internal setupCanvasClickHandler from events.html
 * @param {number} diagramId - The diagram ID
 */
function setupCanvasClickHandlerForDiagram(diagramId) {
  const canvas = document.getElementById("diagram-canvas-" + diagramId);
  if (!canvas) return;

  const dialog = document.getElementById("person-dialog");
  const personCombo = document.getElementById("person-combo");
  const personList = document.getElementById("person-list");
  const personLoading = document.getElementById("person-loading");

  canvas.addEventListener("click", function (e) {
    const diagram = diagrams.find(function (d) {
      return d.id === diagramId;
    });
    if (!diagram) return;

    const rect = canvas.getBoundingClientRect();
    const groups = diagram.groups;
    const rows = diagram.rows || 2;
    const cols = diagram.columns || 2;
    const groupCount = groups.length;

    // Use the same layout calculation as drawing
    const layout = calcDiagramLayout(canvas, groupCount, rows, cols);
    const {
      squareWidth,
      squareHeight,
      squareSpacingX,
      squareSpacingY,
      spacing,
      gridWidth,
      offsetX0,
      offsetY,
    } = layout;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    for (let g = 0; g < groupCount; g++) {
      const offsetX = offsetX0 + g * (gridWidth + spacing);
      const groupAreaWidth = squareWidth * cols + squareSpacingX * (cols - 1);
      const groupAreaHeight = squareHeight * rows + squareSpacingY * (rows - 1);
      if (
        clickX >= offsetX &&
        clickX <= offsetX + groupAreaWidth &&
        clickY >= offsetY &&
        clickY <= offsetY + groupAreaHeight
      ) {
        const x = clickX - offsetX;
        const y = clickY - offsetY;
        const col = Math.floor(x / (squareWidth + squareSpacingX));
        const row = Math.floor(y / (squareHeight + squareSpacingY));
        if (col >= cols || row >= rows) return;
        const idx = row * cols + col;

        // Store selection in global scope for dialog handling
        window.selectedDiagramId = diagramId;
        window.selectedGroup = g;
        window.selectedSquare = idx;

        // Populate and show dialog
        populatePersonListForDiagram(diagram, g, idx);
        return;
      }
    }
  });
}

/**
 * Populate person list for diagram editing
 * @param {Object} diagram - The diagram object
 * @param {number} g - Group index
 * @param {number} squareIdx - Square index
 */
function populatePersonListForDiagram(diagram, g, squareIdx) {
  closeAllDialogs();
  const dialog = document.getElementById("person-dialog");
  const personCombo = document.getElementById("person-combo");
  const personList = document.getElementById("person-list");
  const personLoading = document.getElementById("person-loading");
  const clearPersonBtn = document.getElementById("clear-person-btn");
  const eventDatetimeInput = document.getElementById("event-datetime-input");

  const cellCount = (diagram.rows || 2) * (diagram.columns || 2);
  let usedNames = [];
  for (let gi = 0; gi < diagram.groups.length; gi++) {
    for (let si = 0; si < cellCount; si++) {
      if (gi === g && si === squareIdx) continue;
      if (diagram.groups[gi][si]) usedNames.push(diagram.groups[gi][si]);
    }
  }

  // Check if event is in the past - if so, include inactive members
  let isEventInPast = false;
  if (eventDatetimeInput && eventDatetimeInput.value) {
    const eventDate = new Date(eventDatetimeInput.value);
    const now = new Date();
    isEventInPast = eventDate < now;
  }

  // Filter members: only active for future events, all for past events
  const personNames = membersData
    .filter(function (m) {
      return isEventInPast || m.active;
    })
    .map(function (m) {
      return m.name;
    })
    .filter(Boolean);
  window.currentOptions = personNames.filter(function (name) {
    return !usedNames.includes(name) || diagram.groups[g][squareIdx] === name;
  });

  personList.innerHTML = "";

  if (window.currentOptions.length === 0) {
    personCombo.style.display = "none";
    personLoading.style.display = "block";
    personLoading.querySelector(".dialog-spinner").style.display = "none";
    personLoading.querySelector("p").textContent =
      "No hi ha membres disponibles";
  } else {
    personCombo.style.display = "block";
    personLoading.style.display = "none";
    personCombo.placeholder = "Cerca o selecciona...";
    personCombo.disabled = false;
    window.currentOptions.forEach(function (name) {
      const option = document.createElement("option");
      option.value = name;
      personList.appendChild(option);
    });
  }

  personCombo.value = diagram.groups[g][squareIdx] || "";
  clearPersonBtn.style.display = diagram.groups[g][squareIdx]
    ? "block"
    : "none";
  if (dialog) {
    dialog.showModal();
  }
}

/**
 * Refresh events list in planning view
 */
function refreshPlanningEvents() {
  const refreshBtn = document.getElementById("refresh-event-btn");

  if (refreshBtn) {
    refreshBtn.classList.add("refreshing");
    refreshBtn.disabled = true;
  }

  API.getEvents({ forceRefresh: true })
    .then(function (events) {
      if (refreshBtn) {
        refreshBtn.classList.remove("refreshing");
        refreshBtn.disabled = false;
      }
      renderPlanningEventsList(events);
      showToast("Llista actualitzada", "success");
    })
    .catch(function (error) {
      if (refreshBtn) {
        refreshBtn.classList.remove("refreshing");
        refreshBtn.disabled = false;
      }
      showToast("Error actualitzant la llista", "error");
    });
}

/**
 * Refresh trainings list in planning view
 */
function refreshPlanningTrainings() {
  const refreshBtn = document.getElementById("refresh-training-btn");

  if (refreshBtn) {
    refreshBtn.classList.add("refreshing");
    refreshBtn.disabled = true;
  }

  API.getTrainings({ forceRefresh: true })
    .then(function (trainings) {
      if (refreshBtn) {
        refreshBtn.classList.remove("refreshing");
        refreshBtn.disabled = false;
      }
      renderPlanningTrainingsList(trainings);
      showToast("Llista actualitzada", "success");
    })
    .catch(function (error) {
      if (refreshBtn) {
        refreshBtn.classList.remove("refreshing");
        refreshBtn.disabled = false;
      }
      showToast("Error actualitzant la llista", "error");
    });
}

/**
 * Load dashboard data
 */
function loadDashboardData() {
  // Update user display name
  document.querySelectorAll(".user-display-name").forEach(function (el) {
    el.textContent = AppState.currentUser?.displayName || "Usuari";
  });

  // Load stats
  // API.getDashboardStats()
  //   .then(function (data) {
  //     document.getElementById("stat-projects").textContent = data.projects || 0;
  //     document.getElementById("stat-tasks").textContent = data.tasks || 0;
  //     document.getElementById("stat-completed").textContent =
  //       data.completed || 0;
  //     document.getElementById("stat-pending").textContent = data.pending || 0;
  //   })
  //   .catch(function (error) {
  //     console.error("Failed to load stats:", error);
  //   });

  // Load activity
  // API.getUserActivity()
  //   .then(function (activities) {
  //     const activityList = document.getElementById("activity-list");
  //     if (activities && activities.length > 0) {
  //       activityList.innerHTML = activities
  //         .map(function (activity) {
  //           return `
  //                       <div class="activity-item">
  //                       <div class="activity-icon">${activity.icon || "📝"}</div>
  //                       <div class="activity-content">
  //                           <p>${activity.description}</p>
  //                           <span class="activity-time">${formatRelativeTime(activity.timestamp)}</span>
  //                       </div>
  //                       </div>
  //                   `;
  //         })
  //         .join("");
  //     } else {
  //       activityList.innerHTML =
  //         '<p class="text-muted">No hi ha activitat recent</p>';
  //     }
  //   })
  //   .catch(function (error) {
  //     document.getElementById("activity-list").innerHTML =
  //       "<p class=\"text-muted\">No s'ha pogut carregar l'activitat</p>";
  //   });
  showToast("Informació detallada no disponible al moment.", "info");
}

// Members table state
var membersData = [];
var membersSortColumn = "active";
var membersSortDirection = "desc";

/**
 * Refresh members list from database with visual feedback
 */
function refreshMembersList() {
  const refreshBtn = document.getElementById("refresh-members-btn");

  // Add spinning animation
  if (refreshBtn) {
    refreshBtn.classList.add("refreshing");
    refreshBtn.disabled = true;
  }

  // Show loading state in the table
  const tbody = document.querySelector("#members-table tbody");
  if (tbody)
    tbody.innerHTML = '<tr><td colspan="6">Actualitzant membres...</td></tr>';

  API.getMembers({ forceRefresh: true })
    .then(function (members) {
      // Remove spinning animation
      if (refreshBtn) {
        refreshBtn.classList.remove("refreshing");
        refreshBtn.disabled = false;
      }

      if (!Array.isArray(members)) {
        tbody.innerHTML =
          '<tr><td colspan="6">No s\'ha pogut carregar la llista de membres</td></tr>';
        return;
      }
      membersData = members;
      renderMembersTable();
      showToast("Llista actualitzada", "success");
    })
    .catch(function (error) {
      // Remove spinning animation
      if (refreshBtn) {
        refreshBtn.classList.remove("refreshing");
        refreshBtn.disabled = false;
      }
      tbody.innerHTML =
        '<tr><td colspan="6">No s\'ha pogut carregar la llista de membres</td></tr>';
      showToast("Error actualitzant la llista", "error");
    });
}

function loadMembersData() {
  // Show loading state in the table
  const tbody = document.querySelector("#members-table tbody");
  if (tbody)
    tbody.innerHTML = '<tr><td colspan="5">Carregant membres...</td></tr>';

  API.getMembers()
    .then(function (members) {
      if (!Array.isArray(members)) {
        tbody.innerHTML =
          '<tr><td colspan="5">No s\'ha pogut carregar la llista de membres</td></tr>';
        return;
      }
      membersData = members;
      initMembersFilters();
      renderMembersTable();
    })
    .catch(function (error) {
      tbody.innerHTML =
        '<tr><td colspan="5">No s\'ha pogut carregar la llista de membres</td></tr>';
    });
}

// Load members data silently for events view (without updating members table)
function loadMembersDataForEvents() {
  API.getMembers()
    .then(function (members) {
      if (Array.isArray(members)) {
        membersData = members;
      }
    })
    .catch(function (error) {
      console.error("Error loading members for events:", error);
    });
}

var membersTypeFilterValue = "";
var membersActiveFilterValue = ""; // '', 'true', 'false'
var membersRolsFilterValue = ""; // '', 'ADMIN', 'NO_ADMIN'
var membersAccessFilterValue = ""; // '', 'HAS_ACCESS', 'NO_ACCESS'

function initMembersFilters() {
  const searchInput = document.getElementById("members-search");
  const sortableHeaders = document.querySelectorAll(
    "#members-table th.sortable",
  );

  // Remove existing listeners by cloning and replacing
  if (searchInput && !searchInput.dataset.initialized) {
    searchInput.addEventListener("input", renderMembersTable);
    searchInput.dataset.initialized = "true";
  }
  sortableHeaders.forEach(function (th) {
    if (!th.dataset.initialized) {
      th.addEventListener("click", function () {
        const column = th.getAttribute("data-sort");
        if (membersSortColumn === column) {
          membersSortDirection =
            membersSortDirection === "asc" ? "desc" : "asc";
        } else {
          membersSortColumn = column;
          membersSortDirection = "asc";
        }
        updateSortIcons();
        renderMembersTable();
      });
      th.dataset.initialized = "true";
    }
  });
  updateSortIcons();

  // Long press on Type header to show filter dropdown
  const typeHeader = document.querySelector(
    '#members-table th[data-sort="type"]',
  );
  if (typeHeader && !typeHeader.dataset.longpressInitialized) {
    let longPressTimer = null;
    let longPressTriggered = false;
    const longPressDuration = 500; // ms

    function showTypeFilterDropdown(e) {
      e.preventDefault();
      e.stopPropagation();
      longPressTriggered = true;

      // Remove any existing dropdown
      const existingDropdown = document.getElementById("type-filter-dropdown");
      if (existingDropdown) existingDropdown.remove();

      // Create dropdown
      const dropdown = document.createElement("div");
      dropdown.id = "type-filter-dropdown";
      dropdown.className = "type-filter-dropdown";
      dropdown.innerHTML = `
<div class="type-filter-option" data-value="">Tots els tipus</div>
<div class="type-filter-option" data-value="ADULT">Adult</div>
<div class="type-filter-option" data-value="KID">Xiquet/a</div>
`;

      // Position dropdown below the header
      const rect = typeHeader.getBoundingClientRect();
      dropdown.style.top = rect.bottom + window.scrollY + "px";
      dropdown.style.left = rect.left + "px";

      // Mark current selection and add click handlers
      dropdown.querySelectorAll(".type-filter-option").forEach(function (opt) {
        if (opt.getAttribute("data-value") === membersTypeFilterValue) {
          opt.classList.add("selected");
        }
        opt.addEventListener("click", function () {
          membersTypeFilterValue = this.getAttribute("data-value");
          dropdown.remove();
          renderMembersTable();
        });
      });

      document.body.appendChild(dropdown);

      // Close on click outside
      function closeDropdown(event) {
        if (!dropdown.contains(event.target)) {
          dropdown.remove();
          document.removeEventListener("click", closeDropdown);
        }
      }
      setTimeout(function () {
        document.addEventListener("click", closeDropdown);
      }, 0);
    }

    function startLongPress(e) {
      longPressTriggered = false;
      longPressTimer = setTimeout(function () {
        showTypeFilterDropdown(e);
      }, longPressDuration);
    }

    function cancelLongPress() {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    // Prevent click from sorting when long press was triggered
    typeHeader.addEventListener(
      "click",
      function (e) {
        if (longPressTriggered) {
          e.stopImmediatePropagation();
          longPressTriggered = false;
        }
      },
      true,
    );

    // Mouse events
    typeHeader.addEventListener("mousedown", startLongPress);
    typeHeader.addEventListener("mouseup", cancelLongPress);
    typeHeader.addEventListener("mouseleave", cancelLongPress);

    // Touch events for mobile
    typeHeader.addEventListener("touchstart", startLongPress, {
      passive: true,
    });
    typeHeader.addEventListener("touchend", cancelLongPress);
    typeHeader.addEventListener("touchcancel", cancelLongPress);
    typeHeader.addEventListener("touchmove", cancelLongPress);

    // Prevent context menu on long press
    typeHeader.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      showTypeFilterDropdown(e);
    });

    typeHeader.dataset.longpressInitialized = "true";
  }

  // Click on last column header to show Active filter dropdown
  const activeHeader = document.getElementById("active-filter-header");
  if (activeHeader && !activeHeader.dataset.initialized) {
    activeHeader.style.cursor = "pointer";

    activeHeader.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      // Remove any existing dropdown
      const existingDropdown = document.getElementById(
        "active-filter-dropdown",
      );
      if (existingDropdown) {
        existingDropdown.remove();
        return; // Toggle off if already open
      }

      // Create dropdown
      const dropdown = document.createElement("div");
      dropdown.id = "active-filter-dropdown";
      dropdown.className = "type-filter-dropdown";
      dropdown.innerHTML = `
<div class="type-filter-option" data-value="">Tots</div>
<div class="type-filter-option" data-value="true">En actiu</div>
<div class="type-filter-option" data-value="false">No actiu</div>
`;

      // Position dropdown below the header
      const rect = activeHeader.getBoundingClientRect();
      dropdown.style.top = rect.bottom + window.scrollY + "px";
      dropdown.style.left = rect.right - 160 + "px"; // Align to right edge

      // Mark current selection and add click handlers
      dropdown.querySelectorAll(".type-filter-option").forEach(function (opt) {
        if (opt.getAttribute("data-value") === membersActiveFilterValue) {
          opt.classList.add("selected");
        }
        opt.addEventListener("click", function () {
          membersActiveFilterValue = this.getAttribute("data-value");
          dropdown.remove();
          renderMembersTable();
        });
      });

      document.body.appendChild(dropdown);

      // Close on click outside
      function closeDropdown(event) {
        if (!dropdown.contains(event.target) && event.target !== activeHeader) {
          dropdown.remove();
          document.removeEventListener("click", closeDropdown);
        }
      }
      setTimeout(function () {
        document.addEventListener("click", closeDropdown);
      }, 0);
    });

    activeHeader.dataset.initialized = "true";
  }
}

function updateSortIcons() {
  const headers = document.querySelectorAll("#members-table th.sortable");
  headers.forEach(function (th) {
    const icon = th.querySelector(".sort-icon");
    if (th.getAttribute("data-sort") === membersSortColumn) {
      icon.textContent = membersSortDirection === "asc" ? " ▲" : " ▼";
    } else {
      icon.textContent = "";
    }
  });
}

function renderMembersTable() {
  const tbody = document.querySelector("#members-table tbody");
  if (!tbody) return;

  const searchValue = (
    document.getElementById("members-search")?.value || ""
  ).toLowerCase();
  const typeFilter = membersTypeFilterValue || "";
  const rolsFilter = membersRolsFilterValue || "";

  // Filter
  var filtered = membersData.filter(function (member) {
    const matchesSearch =
      !searchValue ||
      (member.alias || "").toLowerCase().includes(searchValue) ||
      (member.name || "").toLowerCase().includes(searchValue) ||
      (member.email || "").toLowerCase().includes(searchValue) ||
      (member.relatedMembers || [])
      .map((m) => m.alias || m.name || "")
      .join(" ").toLowerCase().includes(searchValue);
    const matchesType = !typeFilter || member.type === typeFilter;
    const matchesActive =
      !membersActiveFilterValue ||
      (membersActiveFilterValue === "true" && member.active !== false) ||
      (membersActiveFilterValue === "false" && member.active === false);

    // Rols filter
    let matchesRols = true;
    if (rolsFilter === "ADMIN") {
      matchesRols = (member.roles || []).includes("ADMIN");
    } else if (rolsFilter === "NO_ADMIN") {
      matchesRols = !(member.roles || []).includes("ADMIN");
    }

    // Access filter (Relations)
    let matchesAccess = true;
    const accessFilter = membersAccessFilterValue || "";
    if (accessFilter === "HAS_ACCESS") {
      matchesAccess = (member.relatedMembers || []).length > 0;
    } else if (accessFilter === "NO_ACCESS") {
      matchesAccess = (member.relatedMembers || []).length === 0;
    }

    return (
      matchesSearch &&
      matchesType &&
      matchesActive &&
      matchesRols &&
      matchesAccess
    );
  });

  // Sort
  filtered.sort(function (a, b) {
    var valA, valB;
    switch (membersSortColumn) {
      case "active":
        valA = a.active !== false ? 1 : 0;
        valB = b.active !== false ? 1 : 0;
        break;
      case "type":
        valA = a.type || "";
        valB = b.type || "";
        break;
      case "name":
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
        break;
      case "email":
        valA = (a.email || "").toLowerCase();
        valB = (b.email || "").toLowerCase();
        break;
      default:
        valA = "";
        valB = "";
    }
    if (valA < valB) return membersSortDirection === "asc" ? -1 : 1;
    if (valA > valB) return membersSortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Render
  tbody.innerHTML = "";
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8">No s\'han trobat membres</td></tr>';
    return;
  }
  filtered.forEach(function (member) {
    const tr = document.createElement("tr");
    tr.classList.add("clickable-row");
    tr.setAttribute("data-member-id", member.id);
    const isEditing =
      currentEditingMemberId === member.id || isEditingAllMembers;

    if (isEditing) {
      tr.classList.add("editing-row");
      tr.innerHTML = renderEditableRow(member);
    } else {
      const typeLabel =
        member.type === "ADULT"
          ? "Adult"
          : member.type === "KID"
            ? "Xiquet/a"
            : "";
      const rolesHtml =
        (member.roles || [])
          .map(function (role) {
            return `<span class="role">${role}</span>`;
          })
          .join("") || "-";
      const nameStyle =
        member.active === false ? "text-decoration: line-through;" : "";
      const showPasswordBtn = member.type === "ADULT" && member.email;
      const activeIndicator = member.active !== false ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #4caf50;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #999;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      const passwordBtnHtml = showPasswordBtn
        ? `
        <button type="button" class="btn-change-password" title="Canviar contrasenya" data-member-id="${member.id}" data-member-name="${member.alias}" data-member-email="${member.email}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
        </button>`
        : "";
      tr.innerHTML = `
<td style="${nameStyle}">${member.alias || ""}</td>
<td>${member.email || ""}</td>
<td class="type-${(member.type || "").toLowerCase()}">${typeLabel}</td>
<td>${rolesHtml}</td>
<td>${(member.relatedMembers || []).map(rm => rm.alias || rm.name || "").join(", ") || "-"}</td>
<td class="active-column" style="display: none;"></td>
<td style="text-align: center;">${activeIndicator}</td>
<td style="text-align: center;">${passwordBtnHtml}</td>
`;
    }
    tbody.appendChild(tr);
  });
}

// Current member being edited inline
var currentEditingMemberId = null;
var originalMemberData = null;
var isAddingNewMember = false;

/**
 * Start adding a new member - creates a temporary row for input
 */
function startAddNewMember() {
  // Cancel any existing edit
  if (currentEditingMemberId) {
    cancelInlineEdit();
  }

  // Set flag for new member mode
  isAddingNewMember = true;

  // Create a temporary member object
  const newMember = {
    ID: "__new__",
    Name: "",
    Email: "",
    Type: "ADULT",
    Roles: [],
    Relations: [],
  };

  currentEditingMemberId = "__new__";
  originalMemberData = null;

  // Add temporary member to data array at the beginning
  membersData.unshift(newMember);

  // Show action bar with different text
  const actionsBar = document.getElementById("members-edit-actions");
  const editInfo = actionsBar.querySelector(".edit-info");
  if (actionsBar) {
    actionsBar.style.display = "flex";
    if (editInfo) editInfo.textContent = "Afegint nou membre...";
  }

  // Re-render table to show editable row
  renderMembersTable();

  // Focus on name input
  const nameInput = document.querySelector('input[name="inline-name"]');
  if (nameInput) nameInput.focus();

  // Initialize action bar listeners
  initInlineEditListeners();
}

/**
 * Render an editable row for inline editing
 * @param {Object} member - The member data
 * @returns {string} HTML for the editable row
 */
function renderEditableRow(member) {
  const typeOptions = `
        <option value="ADULT" ${member.type === "ADULT" ? "selected" : ""}>Adult</option>
        <option value="KID" ${member.type === "KID" ? "selected" : ""}>Xiquet/a</option>
    `;

  const isAdmin = (member.roles || []).includes("ADMIN");
  const isKid = member.type === "KID";

  // Email field (disabled for KID)
  const emailHtml = isKid
    ? '<span class="text-muted">-</span>'
    : `<input type="email" class="inline-edit-input" name="inline-email" value="${member.email || ""}">`;

  // Roles field (disabled for KID)
  const rolesHtml = isKid
    ? '<span class="text-muted">-</span>'
    : `<label class="checkbox-label inline-checkbox">
                <input type="checkbox" name="inline-admin" ${isAdmin ? "checked" : ""}> Admin
            </label>`;

  // Build relations checkboxes (only for ADULT members)
  let relationsHtml = "";
  if (isKid) {
    relationsHtml = '<span class="text-muted">-</span>';
  } else {
    relationsHtml =
      '<div class="inline-relations-dropdown" id="inline-relations-container">';
    relationsHtml +=
      '<button type="button" class="btn-dropdown" onclick="toggleRelationsDropdown(this)">Seleccionar ▼</button>';
    relationsHtml +=
      '<div class="relations-dropdown-content" style="display:none;">';
    membersData.forEach(function (m) {
      if (m.id !== member.id) {
        const checked = (member.relations || []).includes(m.id)
          ? "checked"
          : "";
        relationsHtml += `<label class="checkbox-label"><input type="checkbox" name="inline-relations" value="${m.id}" data-name="${m.name}" ${checked}> ${m.name}</label>`;
      }
    });
    relationsHtml += "</div></div>";
  }

  const isActive = member.active !== false;
  return `
        <td><input type="text" class="inline-edit-input" name="inline-name" value="${member.alias || ""}" required></td>
        <td class="email-cell">${emailHtml}</td>
        <td>
        <select class="inline-edit-select" name="inline-type" onchange="handleInlineTypeChange(this)">${typeOptions}</select>
        </td>
        <td class="roles-cell">${rolesHtml}</td>
        <td class="relations-cell">${relationsHtml}</td>
        <td class="active-column">
        <label class="checkbox-label inline-checkbox">
            <input type="checkbox" name="inline-active" ${isActive ? "checked" : ""}> Actiu
        </label>
        </td>
        <td></td>
        <td></td>
    `;
}

/**
 * Toggle relations dropdown visibility
 */
function toggleRelationsDropdown(btn) {
  const dropdown = btn.nextElementSibling;
  dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
}

/**
 * Handle type change during inline edit - KID cannot have email, roles, or relations
 */
function handleInlineTypeChange(selectEl) {
  const row = selectEl.closest("tr");
  const emailCell = row.querySelector(".email-cell");
  const rolesCell = row.querySelector(".roles-cell");
  const relationsCell = row.querySelector(".relations-cell");
  const memberId = row.getAttribute("data-member-id");
  const member = membersData.find(function (m) {
    return m.id === memberId;
  });

  if (selectEl.value === "KID") {
    // Clear and disable email, roles, and relations for KID
    if (emailCell) emailCell.innerHTML = '<span class="text-muted">-</span>';
    if (rolesCell) rolesCell.innerHTML = '<span class="text-muted">-</span>';
    if (relationsCell)
      relationsCell.innerHTML = '<span class="text-muted">-</span>';
  } else {
    // Restore email field for ADULT
    if (emailCell) {
      const email = member ? member.email || "" : "";
      emailCell.innerHTML = `<input type="email" class="inline-edit-input" name="inline-email" value="${email}">`;
    }

    // Restore roles for ADULT
    if (rolesCell) {
      const isAdmin = member && (member.roles || []).includes("ADMIN");
      rolesCell.innerHTML = `<label class="checkbox-label inline-checkbox">
                <input type="checkbox" name="inline-admin" ${isAdmin ? "checked" : ""}> Admin
            </label>`;
    }

    // Restore relations dropdown for ADULT
    if (relationsCell) {
      let relationsHtml =
        '<div class="inline-relations-dropdown" id="inline-relations-container">';
      relationsHtml +=
        '<button type="button" class="btn-dropdown" onclick="toggleRelationsDropdown(this)">Seleccionar ▼</button>';
      relationsHtml +=
        '<div class="relations-dropdown-content" style="display:none;">';
      membersData.forEach(function (m) {
        if (m.id !== memberId) {
          const checked =
            member && (member.relations || []).includes(m.id)
              ? "checked"
              : "";
          relationsHtml += `<label class="checkbox-label"><input type="checkbox" name="inline-relations" value="${m.id}" data-name="${m.name}" ${checked}> ${m.name}</label>`;
        }
      });
      relationsHtml += "</div></div>";
      relationsCell.innerHTML = relationsHtml;
    }
  }
}

/**
 * Start inline editing for a member
 * @param {string} memberId - ID of the member to edit
 */
function startInlineEdit(memberId) {
  // If already editing another member, cancel that edit first
  if (currentEditingMemberId && currentEditingMemberId !== memberId) {
    cancelInlineEdit();
  }

  const member = membersData.find(function (m) {
    return m.id === memberId;
  });
  if (!member) {
    showToast("Membre no trobat", "error");
    return;
  }

  // Store original data for discard
  currentEditingMemberId = memberId;
  originalMemberData = JSON.parse(JSON.stringify(member));

  // Show action bar
  const actionsBar = document.getElementById("members-edit-actions");
  if (actionsBar) {
    actionsBar.style.display = "flex";
  }

  // Show Active column
  document.querySelectorAll(".active-column").forEach(function (el) {
    el.style.display = "";
  });

  // Re-render table to show editable row
  renderMembersTable();

  // Initialize action bar listeners
  initInlineEditListeners();
}

// Track all original data when editing all members
var allOriginalMemberData = null;
var isEditingAllMembers = false;

/**
 * Start editing all members at once
 */
function startEditAllMembers() {
  // Cancel any existing single edit
  if (currentEditingMemberId) {
    cancelInlineEdit();
  }

  // Store original data for all members
  allOriginalMemberData = JSON.parse(JSON.stringify(membersData));
  isEditingAllMembers = true;
  currentEditingMemberId = "__all__";

  // Show action bar
  const actionsBar = document.getElementById("members-edit-actions");
  const editInfo = actionsBar ? actionsBar.querySelector(".edit-info") : null;
  if (actionsBar) {
    actionsBar.style.display = "flex";
    if (editInfo) editInfo.textContent = "Editant tots els membres...";
  }

  // Hide edit button
  const editAllBtn = document.getElementById("edit-all-members-btn");
  if (editAllBtn) editAllBtn.style.display = "none";

  // Show Active column
  document.querySelectorAll(".active-column").forEach(function (el) {
    el.style.display = "";
  });

  // Re-render table with all rows editable
  renderMembersTable();

  // Initialize action bar listeners
  initInlineEditListeners();
}

/**
 * Initialize inline edit action bar listeners
 */
function initInlineEditListeners() {
  const discardBtn = document.getElementById("members-edit-discard");
  const applyBtn = document.getElementById("members-edit-apply");

  if (discardBtn && !discardBtn.dataset.initialized) {
    discardBtn.addEventListener("click", cancelInlineEdit);
    discardBtn.dataset.initialized = "true";
  }

  if (applyBtn && !applyBtn.dataset.initialized) {
    applyBtn.addEventListener("click", applyInlineEdit);
    applyBtn.dataset.initialized = "true";
  }
}

// Password change dialog handling
var passwordChangeMemberEmail = null;

function initPasswordChangeHandlers() {
  const dialog = document.getElementById("password-change-dialog");
  const cancelBtn = document.getElementById("password-cancel-btn");
  const saveBtn = document.getElementById("password-save-btn");

  if (cancelBtn && !cancelBtn.dataset.initialized) {
    cancelBtn.addEventListener("click", closePasswordDialog);
    cancelBtn.dataset.initialized = "true";
  }

  if (saveBtn && !saveBtn.dataset.initialized) {
    saveBtn.addEventListener("click", saveNewPassword);
    saveBtn.dataset.initialized = "true";
  }

  // Close on backdrop click
  if (dialog && !dialog.dataset.initialized) {
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) {
        closePasswordDialog();
      }
    });
    dialog.dataset.initialized = "true";
  }
}

function openPasswordDialog(email, name) {
  closeAllDialogs();
  const dialog = document.getElementById("password-change-dialog");
  const memberNameEl = document.getElementById("password-change-member-name");
  const newPasswordInput = document.getElementById("new-password");
  const confirmPasswordInput = document.getElementById("confirm-password");

  if (!dialog) return;

  passwordChangeMemberEmail = email;
  if (memberNameEl) memberNameEl.textContent = name + " (" + email + ")";
  if (newPasswordInput) newPasswordInput.value = "";
  if (confirmPasswordInput) confirmPasswordInput.value = "";

  initPasswordChangeHandlers();
  dialog.showModal();
  if (newPasswordInput) newPasswordInput.focus();
}

function closePasswordDialog() {
  const dialog = document.getElementById("password-change-dialog");
  if (dialog) dialog.close();
  passwordChangeMemberEmail = null;
}

function saveNewPassword() {
  const newPassword = document.getElementById("new-password")?.value || "";
  const confirmPassword =
    document.getElementById("confirm-password")?.value || "";
  const saveBtn = document.getElementById("password-save-btn");

  // Validation
  if (!newPassword) {
    showToast("Cal introduir una contrasenya", "error");
    return;
  }

  if (newPassword.length < 8) {
    showToast("La contrasenya ha de tenir almenys 8 caràcters", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("Les contrasenyes no coincideixen", "error");
    return;
  }

  if (!passwordChangeMemberEmail) {
    showToast("Error: no s'ha seleccionat cap membre", "error");
    return;
  }

  // Disable button during save
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Desant...";
  }

  API.changeUserPassword({ email: passwordChangeMemberEmail, newPassword })
    .then(function (result) {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Desar";
      }
      closePasswordDialog();
      showToast(
        result.message || "Contrasenya canviada correctament",
        "success",
      );
    })
    .catch(function (error) {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Desar";
      }
      showToast(error || "Error en canviar la contrasenya", "error");
      console.error("Password change error:", error);
    });
}

// Event delegation for password change buttons in members table
document.addEventListener("click", function (e) {
  const btn = e.target.closest(".btn-change-password");
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    const email = btn.getAttribute("data-member-email");
    const name = btn.getAttribute("data-member-name");
    if (email) {
      openPasswordDialog(email, name);
    }
  }
});

/**
 * Cancel inline edit and restore original data
 */
function cancelInlineEdit() {
  // If adding a new member, remove the temporary entry
  if (isAddingNewMember) {
    membersData = membersData.filter(function (m) {
      return m.id !== "__new__";
    });
    isAddingNewMember = false;
  }

  // If editing all members, restore all original data
  if (isEditingAllMembers && allOriginalMemberData) {
    membersData = allOriginalMemberData;
    allOriginalMemberData = null;
    isEditingAllMembers = false;
  }

  currentEditingMemberId = null;
  originalMemberData = null;

  // Hide action bar and restore text
  const actionsBar = document.getElementById("members-edit-actions");
  const editInfo = actionsBar?.querySelector(".edit-info");
  if (actionsBar) {
    actionsBar.style.display = "none";
    if (editInfo) editInfo.textContent = "Editant membres...";
  }

  // Show edit button again
  const editAllBtn = document.getElementById("edit-all-members-btn");
  if (editAllBtn) editAllBtn.style.display = "";

  // Hide Active column
  document.querySelectorAll(".active-column").forEach(function (el) {
    el.style.display = "none";
  });

  // Re-render table
  renderMembersTable();
}

/**
 * Apply inline edit changes
 */
function applyInlineEdit() {
  if (!currentEditingMemberId) return;

  // Handle editing all members
  if (isEditingAllMembers) {
    applyAllMembersEdit();
    return;
  }

  const applyBtn = document.getElementById("members-edit-apply");
  const btnText = applyBtn.querySelector(".btn-text");
  const btnLoading = applyBtn.querySelector(".btn-loading");

  // Show loading state
  btnText.style.display = "none";
  btnLoading.style.display = "inline";
  applyBtn.disabled = true;

  // Gather data from inline inputs
  const row = document.querySelector(
    `tr[data-member-id="${currentEditingMemberId}"]`,
  );
  if (!row) {
    showToast("Error: fila no trobada", "error");
    return;
  }

  const activeCheckbox = row.querySelector('input[name="inline-active"]');
  const memberData = {
    ID: currentEditingMemberId === "__new__" ? null : currentEditingMemberId,
    Name: row.querySelector('input[name="inline-name"]').value.trim(),
    Email: "",
    Type: row.querySelector('select[name="inline-type"]').value,
    Roles: [],
    Relations: [],
    Active: activeCheckbox ? activeCheckbox.checked : true,
    isNew: isAddingNewMember,
  };

  // Only get email, roles, and relations for ADULT members
  if (memberData.type !== "KID") {
    // Get email
    const emailInput = row.querySelector('input[name="inline-email"]');
    if (emailInput) {
      memberData.email = emailInput.value.trim();
    }

    // Get admin role
    const adminCheckbox = row.querySelector('input[name="inline-admin"]');
    if (adminCheckbox && adminCheckbox.checked) {
      memberData.roles.push("ADMIN");
    }

    // Get selected relations (as IDs)
    const relationCheckboxes = row.querySelectorAll(
      'input[name="inline-relations"]:checked',
    );
    relationCheckboxes.forEach(function (checkbox) {
      memberData.relations.push(checkbox.value);
    });
  }

  // Call server to save
  API.saveMember({ member: memberData })
    .then(function (result) {
      btnText.style.display = "inline";
      btnLoading.style.display = "none";
      applyBtn.disabled = false;

      if (result && result.success) {
        const successMsg = isAddingNewMember
          ? "Membre creat correctament"
          : "Membre desat correctament";
        showToast(successMsg, "success");
        currentEditingMemberId = null;
        originalMemberData = null;
        isAddingNewMember = false;

        // Hide action bar and restore text
        const actionsBar = document.getElementById("members-edit-actions");
        const editInfo = actionsBar?.querySelector(".edit-info");
        if (actionsBar) {
          actionsBar.style.display = "none";
          if (editInfo) editInfo.textContent = "Editant membre...";
        }

        // Hide Active column
        document.querySelectorAll(".active-column").forEach(function (el) {
          el.style.display = "none";
        });

        // Reload members data
        loadMembersData();
      } else {
        showToast(result?.error || "Error desant el membre", "error");
      }
    })
    .catch(function (error) {
      btnText.style.display = "inline";
      btnLoading.style.display = "none";
      applyBtn.disabled = false;
      showToast("Error desant el membre: " + error, "error");
      console.error("Save member error:", error);
    });
}

/**
 * Apply edits for all members at once
 */
function applyAllMembersEdit() {
  const applyBtn = document.getElementById("members-edit-apply");
  const btnText = applyBtn.querySelector(".btn-text");
  const btnLoading = applyBtn.querySelector(".btn-loading");

  // Show loading state
  btnText.style.display = "none";
  btnLoading.style.display = "inline";
  applyBtn.disabled = true;

  // Gather data from all editable rows
  const rows = document.querySelectorAll("#members-table tbody tr.editing-row");
  const allMemberData = [];

  rows.forEach(function (row) {
    const memberId = row.getAttribute("data-member-id");
    if (!memberId || memberId === "__new__") return;

    const activeCheckbox = row.querySelector('input[name="inline-active"]');
    const typeSelect = row.querySelector('select[name="inline-type"]');
    const memberData = {
      ID: memberId,
      Name: row.querySelector('input[name="inline-name"]').value.trim(),
      Email: "",
      Type: typeSelect ? typeSelect.value : "ADULT",
      Roles: [],
      Relations: [],
      Active: activeCheckbox ? activeCheckbox.checked : true,
    };

    // Only get email, roles, and relations for ADULT members
    if (memberData.type !== "KID") {
      const emailInput = row.querySelector('input[name="inline-email"]');
      if (emailInput) {
        memberData.email = emailInput.value.trim();
      }

      const adminCheckbox = row.querySelector('input[name="inline-admin"]');
      if (adminCheckbox && adminCheckbox.checked) {
        memberData.roles.push("ADMIN");
      }

      const relationCheckboxes = row.querySelectorAll(
        'input[name="inline-relations"]:checked',
      );
      relationCheckboxes.forEach(function (checkbox) {
        memberData.relations.push(checkbox.value);
      });
    }

    allMemberData.push(memberData);
  });

  // Call server to save all members
  API.saveAllMembers({ members: allMemberData })
    .then(function (result) {
      btnText.style.display = "inline";
      btnLoading.style.display = "none";
      applyBtn.disabled = false;

      if (result && result.success) {
        showToast("Tots els membres desats correctament", "success");
        currentEditingMemberId = null;
        allOriginalMemberData = null;
        isEditingAllMembers = false;

        // Hide action bar
        const actionsBar = document.getElementById("members-edit-actions");
        if (actionsBar) {
          actionsBar.style.display = "none";
        }

        // Show edit button again
        const editAllBtn = document.getElementById("edit-all-members-btn");
        if (editAllBtn) editAllBtn.style.display = "";

        // Hide Active column
        document.querySelectorAll(".active-column").forEach(function (el) {
          el.style.display = "none";
        });

        // Reload members data
        loadMembersData();
      } else {
        showToast(result?.error || "Error desant els membres", "error");
      }
    })
    .catch(function (error) {
      btnText.style.display = "inline";
      btnLoading.style.display = "none";
      applyBtn.disabled = false;
      showToast("Error desant els membres: " + error, "error");
      console.error("Save all members error:", error);
    });
}

/**
 * Load home data
 */
function loadHomeData() {
  const userNameEl = document.getElementById("home-user-name");
  if (userNameEl) {
    if (AppState.currentUser && AppState.currentUser.displayName) {
      // Build greeting with user name and relations
      const names = [AppState.currentUser.displayName];
      const relations = AppState.currentUser.relatedMembers || [];
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
  if (nextEventTextEl && AppState.isAuthenticated) {
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
  if (nextTrainingTextEl && AppState.isAuthenticated) {
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
 * Load profile data
 */
function loadProfileData() {
  if (!AppState.currentUser) return;

  const avatarEl = document.getElementById("profile-avatar");
  const nameEl = document.getElementById("profile-name");
  const emailEl = document.getElementById("profile-email");
  const memberTypeEl = document.getElementById("profile-member-type");

  if (avatarEl) avatarEl.src = AppState.currentUser.avatar;
  if (nameEl) nameEl.textContent = AppState.currentUser.displayName;
  if (emailEl) emailEl.textContent = AppState.currentUser.email;
  if (memberTypeEl)
    memberTypeEl.textContent = AppState.currentUser.memberType || "";

  // Roles
  const rolesContainer = document.getElementById("profile-roles");
  const roles = AppState.currentUser.roles || [];
  if (rolesContainer) {
    if (roles.length > 0) {
      rolesContainer.innerHTML = roles
        .map(function (role) {
          return '<span class="badge badge-role">' + role + "</span>";
        })
        .join("");
    } else {
      rolesContainer.innerHTML =
        '<span class="text-muted">Cap rol assignat</span>';
    }
  }

  // Relations
  const relationsContainer = document.getElementById("profile-relations");
  const relations = AppState.currentUser.relations || [];
  if (relationsContainer) {
    if (relations.length > 0) {
      relationsContainer.innerHTML = relations
        .map(function (rel) {
          return '<span class="badge badge-relation">' + rel + "</span>";
        })
        .join("");
    } else {
      relationsContainer.innerHTML =
        '<span class="text-muted">Cap relació</span>';
    }
  }

  // Related Members Cards
  const relatedMembersSection = document.getElementById(
    "related-members-section",
  );
  const relatedMembersList = document.getElementById("related-members-list");
  const relatedMembers = AppState.currentUser.relatedMembers || [];

  if (relatedMembersSection && relatedMembersList) {
    if (relatedMembers.length > 0) {
      relatedMembersSection.style.display = "block";
      relatedMembersList.innerHTML = relatedMembers
        .map(function (member) {
          const avatarUrl =
            member.avatar ||
            "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(member.alias || member.alias || "?") +
              "&background=random";
          const memberName = member.alias || member.alias || "Desconegut";
          const memberType = member.type || member.type || "";
          const memberTypeLabel =
            memberType === "ADULT"
              ? "Adult"
              : memberType === "KID"
                ? "Xiquet/a"
                : memberType;
          return (
            '<div class="profile-header">' +
            '<img class="profile-avatar" src="' +
            avatarUrl +
            '" alt="' +
            memberName +
            '">' +
            '<div class="profile-info">' +
            "<h2>" +
            memberName +
            "</h2>" +
            '<p class="member-type-badge">' +
            memberTypeLabel +
            "</p>" +
            "</div>" +
            "</div>"
          );
        })
        .join("");
    } else {
      relatedMembersSection.style.display = "none";
    }
  }
}

/**
 * Handle registration form submission
 * @param {Event} e - Form submit event
 */
function handleRegisterSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const submitBtn = document.getElementById("register-btn");

  if (!name || !email) {
    showToast("Introdueix el nom i el correu electrònic", "warning");
    return;
  }

  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Enviant...";
  submitBtn.disabled = true;

  API.sendRegistrationRequest({ name, email })
    .then(function (result) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;

      showToast(
        "Sol·licitud enviada correctament. Ens posarem en contacte amb tu!",
        "success",
      );
      document.getElementById("register-form").reset();
      navigateTo("login");
    })
    .catch(function (error) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      showToast(error || "Error en enviar la sol·licitud", "error");
      console.error("Registration error:", error);
    });
}

/**
 * Handle email/password login action
 * @param {Event} e - Form submit event
 */
function handleEmailPasswordLogin(e) {
  e.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const submitBtn = document.getElementById("email-login-btn");

  if (!email || !password) {
    showToast("Introdueix el correu electrònic i la contrasenya", "warning");
    return;
  }

  const originalHtml = submitBtn ? submitBtn.innerHTML : "";
  if (submitBtn) {
    submitBtn.innerHTML =
      '<span class="spinner-small spinner-dark"></span> Iniciant sessió...';
    submitBtn.disabled = true;
    submitBtn.setAttribute("aria-busy", "true");
  }

  API.loginWithEmailPassword({ email, password })
    .then(function (result) {
      
      API.saveToken({ token: result.token });
      if (submitBtn) {
        submitBtn.innerHTML = originalHtml;
        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
      }

      AppState.isAuthenticated = true;
      AppState.currentUser = result.user;

      updateAuthUI();
      showToast(
        "Benvingut/da de nou, " + result.user.displayName + "!",
        "success",
      );
      
      // Close login dialog before navigating
      const loginDialog = document.getElementById("view-login");
      if (loginDialog) {
        loginDialog.close();
      }
      
      navigateTo("home");
    })
    .catch(function (error) {
      if (submitBtn) {
        submitBtn.innerHTML = originalHtml;
        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
      }
      showToast(error || "Error d'inici de sessió", "error");
      console.error("Login error:", error);
    });
}

/**
 * Handle access link request
 */
function handleAccessLink(e) {
  if (e && e.preventDefault) e.preventDefault();
  
  openAccessLinkDialog();
}

/**
 * Open the access link dialog
 */
function openAccessLinkDialog() {
  closeAllDialogs();
  const dialog = document.getElementById("access-link-dialog");
  const emailInput = document.getElementById("access-link-email");
  
  if (!dialog) return;
  
  if (emailInput) emailInput.value = "";
  
  initAccessLinkDialogHandlers();
  dialog.showModal();
  if (emailInput) emailInput.focus();
}

/**
 * Close the access link dialog
 */
function closeAccessLinkDialog() {
  const dialog = document.getElementById("access-link-dialog");
  if (dialog) dialog.close();
}

/**
 * Initialize access link dialog button handlers
 */
function initAccessLinkDialogHandlers() {
  const dialog = document.getElementById("access-link-dialog");
  const cancelBtn = document.getElementById("access-link-cancel-btn");
  const sendBtn = document.getElementById("access-link-send-btn");

  if (cancelBtn && !cancelBtn.dataset.initialized) {
    cancelBtn.addEventListener("click", closeAccessLinkDialog);
    cancelBtn.dataset.initialized = "true";
  }

  if (sendBtn && !sendBtn.dataset.initialized) {
    sendBtn.addEventListener("click", sendAccessLink);
    sendBtn.dataset.initialized = "true";
  }

  // Close on backdrop click
  if (dialog && !dialog.dataset.initialized) {
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) {
        closeAccessLinkDialog();
      }
    });
    dialog.dataset.initialized = "true";
  }
}

/**
 * Send access link with email from dialog
 */
function sendAccessLink() {
  const emailInput = document.getElementById("access-link-email");
  const sendBtn = document.getElementById("access-link-send-btn");
  const email = emailInput ? emailInput.value.trim() : "";

  // Validation
  if (!email) {
    showToast("Cal introduir un correu electrònic", "error");
    return;
  }

  if (!email.includes("@")) {
    showToast("El correu electrònic no és vàlid", "error");
    return;
  }

  // Disable button during save
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = "Enviant...";
  }

  API.sendAccessLink({ email })
    .then(function (result) {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Enviar accés";
      }

      showToast(
        result.message || "Enllaç d'accés enviat al teu correu electrònic",
        "success",
      );
      closeAccessLinkDialog();
    })
    .catch(function (error) {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Enviar accés";
      }
      showToast(error || "Error en enviar l'accés", "error");
      console.error("Access link error:", error);
    });
}

/**
 * Handle login action
 */
function handleLogin() {
  // Navigate to login page
  navigateTo("login");
}

/**
 * Handle logout action
 */
function handleLogout() {
  // Show general loading screen
  showLoading(true);

  // Get the logout buttons (desktop and mobile) and provide immediate feedback
  const logoutBtn = document.getElementById("logout-btn");
  const mobileLogoutBtn = document.getElementById("mobile-logout-btn");
  const originalText = logoutBtn ? logoutBtn.textContent : "";
  const originalMobileText = mobileLogoutBtn ? mobileLogoutBtn.textContent : "";

  if (logoutBtn) {
    logoutBtn.innerHTML =
      '<span class="spinner-small spinner-dark"></span> Tancant sessió...';
    logoutBtn.disabled = true;
    logoutBtn.setAttribute("aria-busy", "true");
  }
  if (mobileLogoutBtn) {
    mobileLogoutBtn.innerHTML =
      '<span class="spinner-small spinner-dark"></span> Tancant sessió...';
    mobileLogoutBtn.disabled = true;
    mobileLogoutBtn.setAttribute("aria-busy", "true");
  }

  // Clear server-side session
  API.logoutUser()
    .then(function (result) {
      // Restore button states
      if (logoutBtn) {
        logoutBtn.innerHTML = originalText;
        logoutBtn.disabled = false;
        logoutBtn.removeAttribute("aria-busy");
      }
      if (mobileLogoutBtn) {
        mobileLogoutBtn.innerHTML = originalMobileText;
        mobileLogoutBtn.disabled = false;
        mobileLogoutBtn.removeAttribute("aria-busy");
      }

      // Clear all local state and temporary user data
      clearUserData();

      updateAuthUI();
      navigateTo("home-guest");
      showToast("Has tancat la sessió", "success");
      showLoading(false);
    })
    .catch(function (error) {
      // Restore button states
      if (logoutBtn) {
        logoutBtn.innerHTML = originalText;
        logoutBtn.disabled = false;
        logoutBtn.removeAttribute("aria-busy");
      }
      if (mobileLogoutBtn) {
        mobileLogoutBtn.innerHTML = originalMobileText;
        mobileLogoutBtn.disabled = false;
        mobileLogoutBtn.removeAttribute("aria-busy");
      }

      // Still clear local state even if server call fails
      clearUserData();

      updateAuthUI();
      navigateTo("home-guest");
      showToast("Has tancat la sessió", "success");
      showLoading(false);
    });
}

/**
 * Clear all user data and temporary state on logout
 */
function clearUserData() {
  // Clear app state
  AppState.isAuthenticated = false;
  AppState.currentUser = null;
  AppState.currentView = "home-guest";
  API.clearSession();

  // Clear localStorage
  localStorage.removeItem("currentRoute");

  // Clear members data
  membersData = [];
  currentEditingMemberId = null;
  originalMemberData = null;
  isAddingNewMember = false;
  allOriginalMemberData = null;
  isEditingAllMembers = false;

  // Clear members filters
  membersTypeFilterValue = "";
  membersActiveFilterValue = "";
  membersRolsFilterValue = "";
  membersAccessFilterValue = "";

  // Clear events/diagrams data if defined
  if (typeof diagrams !== "undefined") {
    diagrams.length = 0;
  }
  if (typeof diagramIdCounter !== "undefined") {
    diagramIdCounter = 0;
  }
  if (typeof diagramsIsDirty !== "undefined") {
    diagramsIsDirty = false;
  }
  if (typeof dancesData !== "undefined") {
    dancesData = [];
  }

  // Reset loading event flag
  isLoadingExistingEvent = false;
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

  if (AppState.isAuthenticated && AppState.currentUser) {
    if (navbarToggle) navbarToggle.style.display = "block";
    // Show user info
    if (userInfo) {
      userInfo.style.display = "flex";
      document.getElementById("user-avatar").src = AppState.currentUser.avatar;
      document.getElementById("user-name").textContent =
        AppState.currentUser.displayName;
    }

    // Update mobile user section
    const mobileUserSection = document.getElementById("mobile-user-section");
    const mobileUserAvatar = document.getElementById("mobile-user-avatar");
    const mobileUserName = document.getElementById("mobile-user-name");
    if (mobileUserAvatar) {
      mobileUserAvatar.src = AppState.currentUser.avatar;
    }
    if (mobileUserName) {
      mobileUserName.textContent = AppState.currentUser.displayName;
    }

    // Show auth-required nav links (excluding admin-only which are handled separately)
    authRequiredLinks.forEach(function (link) {
      if (!link.classList.contains("admin-only")) {
        link.style.display = "";
      }
    });

    // Check if user is admin
    const userRoles = AppState.currentUser.roles || [];
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
      el.textContent = AppState.currentUser.displayName;
    });

    // Update home user name
    const homeUserName = document.getElementById("home-user-name");
    if (homeUserName) {
      homeUserName.textContent = AppState.currentUser.displayName;
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

/**
 * Show or hide loading screen
 * @param {boolean} show - Whether to show loading
 */
function showLoading(show) {
  const loadingScreen = document.getElementById("loading-screen");
  const app = document.getElementById("app");

  if (show) {
    loadingScreen.style.display = "flex";
    app.style.display = "none";
  } else {
    loadingScreen.style.display = "none";
    app.style.display = "flex";
  }

  AppState.isLoading = show;
}

/**
 * Show a toast notification
 * @param {string} message - Message to show
 * @param {string} type - Type: success, error, warning, info
 */
function showToast(message, type = "info") {
  // Find if there's an open dialog
  const openDialog = document.querySelector("dialog[open]");
  const targetParent = openDialog || document.body;

  // Always use document.body for toast container
  let container = document.getElementById("toast-container");
  
  // Create container if it doesn't exist
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };
  
  toast.innerHTML = `
  <span class="toast-icon">${icons[type] || icons.info}</span>
  <span class="toast-message">${message}</span>
  `;
  
  targetParent.appendChild(container);
  container.appendChild(toast);

  // Prevent scroll on dialog when toast appears
  if (openDialog) {
    openDialog.style.overflowY = "hidden";
  }

  // Trigger animation
  setTimeout(function () {
    toast.classList.add("show");
  }, 10);

  // Remove after 3 seconds
  setTimeout(function () {
    toast.classList.add("toast-remove");
    setTimeout(function () {
      toast.remove();
      // Re-enable scroll on dialog when toast is removed
      if (openDialog) {
        openDialog.style.overflowY = "";
      }
    }, 300);
  }, 3000);
}

/**
 * Format relative time
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Relative time string
 */
function formatRelativeTime(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return days + " dia" + (days > 1 ? "s" : "") + " enrere";
  if (hours > 0) return hours + " hora" + (hours > 1 ? "s" : "") + " enrere";
  if (minutes > 0)
    return minutes + " minut" + (minutes > 1 ? "s" : "") + " enrere";
  return "Ara mateix";
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML.replace(/"/g, "").replace(/'/g, "");
}

/**
 * Handle errors globally
 */
window.onerror = function (message, source, lineno, colno, error) {
  console.error("Global error:", message, error);
  showToast("S'ha produït un error. Torna-ho a provar.", "error");
  return false;
};
