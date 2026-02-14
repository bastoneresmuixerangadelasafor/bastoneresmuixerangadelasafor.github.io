const NAVIGATION = new (class AppNavigator {
  constructor() {
    this.currentView = null;
    this.isRestoringHash = false;

    this._configureRouter();
  }

  _configureRouter() {
    window.addEventListener("beforeunload", (e) => {
      if (this._isInEditMode()) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    });

    document.querySelectorAll("[data-route]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const route = link.getAttribute("data-route");
        this.navigateTo(route);
      });
    });

    window.addEventListener("hashchange", (e) => {
      // Skip if we're restoring the hash after blocking navigation
      if (this.isRestoringHash) {
        this.isRestoringHash = false;
        return;
      }
      if (this._isInEditMode()) {
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
          this.navigateTo(route, false);
        } else {
          // User cancelled, restore the hash (use saved route which includes event ID if present)
          this.isRestoringHash = true;
          const savedRoute =
            localStorage.getItem("currentRoute") || this.currentView;
          window.location.hash = savedRoute;
        }
        return;
      }
      const route = window.location.hash.substring(1) || "home";

      // Extract IDs from special hash formats (events/id, training/id)
      if (route.startsWith("events/")) {
        const eventId = decodeURIComponent(route.substring(7));
        if (eventId) {
          APP.eventIdToLoad = escapeHtml(eventId);
          this.navigateTo("edit-event", false);
          return;
        }
      }
      if (route.startsWith("training/")) {
        const trainingId = decodeURIComponent(route.substring(9));
        if (trainingId) {
          APP.trainingIdToLoad = escapeHtml(trainingId);
          this.navigateTo("edit-training", false);
          return;
        }
      }

      this.navigateTo(route, false);
    });

    const navbarToggle = document.getElementById("navbar-toggle");
    if (navbarToggle) {
      navbarToggle.addEventListener("click", function () {
        document.querySelector(".navbar-menu").classList.toggle("active");
      });
    }

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
    if (userMenu) {
      userMenu.querySelectorAll(".user-menu-item").forEach(function (item) {
        item.addEventListener("click", function (e) {
          e.preventDefault();
          userMenu.style.display = "none";
          const view = item.getAttribute("data-menu-view");
          if (view) {
            NAVIGATION.navigateTo(view);
          }
        });
      });
    }

    document
      .querySelectorAll(".mobile-user-actions [data-menu-view]")
      .forEach(function (item) {
        item.addEventListener("click", function (e) {
          e.preventDefault();
          document.querySelector(".navbar-menu")?.classList.remove("active");
          const view = item.getAttribute("data-menu-view");
          if (view) {
            NAVIGATION.navigateTo(view);
          }
        });
      });

  }

  _isInEditMode() {
    // Check members edit mode
    if (MEMBERS.currentEditingMemberId !== null) {
      return true;
    }
    // Check events dirty state
    if (typeof diagramsIsDirty !== "undefined" && diagramsIsDirty) {
      return true;
    }
    return false;
  }

  goToLandingPage() {
    if (APP.isAuthenticated) {
      const hash = window.location.hash.substring(1);
      const savedRoute = localStorage.getItem("currentRoute");
      // Show login page if not authenticated, otherwise show home or saved route
      const initialRoute = hash || savedRoute || "home";
      // Check if the initial route contains an event ID (e.g., events/eventId)
      if (initialRoute.startsWith("events/")) {
        const eventId = decodeURIComponent(initialRoute.substring(7)); // Remove 'events/' prefix and decode
        if (eventId) {
          APP.eventIdToLoad = escapeHtml(eventId);
          this.navigateTo("edit-event", false);
          return;
        }
      }
      // Check if the initial route contains a training ID (e.g., training/trainingId)
      if (initialRoute.startsWith("training/")) {
        const trainingId = decodeURIComponent(initialRoute.substring(9)); // Remove 'training/' prefix and decode
        if (trainingId) {
          APP.trainingIdToLoad = escapeHtml(trainingId);
          this.navigateTo("edit-training", false);
          return;
        }
      }
      this.navigateTo(initialRoute);
    } else {
      this.navigateTo("home-guest");
    }
  }

  navigateTo(route, updateHash = true) {
    const originalRoute = route; // Track original route for hash updates

    // Handle login as a modal dialog instead of navigation
    if (route === "login") {
      APP.closeAllDialogs();
      const loginDialog = document.getElementById("view-login");
      if (loginDialog) {
        showDialogWithBackdrop(loginDialog);
      }
      return;
    }

    // Handle register as a modal dialog instead of navigation
    if (route === "register") {
      APP.closeAllDialogs();
      const registerDialog = document.getElementById("view-register");
      if (registerDialog) {
        showDialogWithBackdrop(registerDialog);
      }
      return;
    }

    // Prevent navigation when in edit mode
    if (this._isInEditMode() && route !== this.currentView) {
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

    // Map special routes to their view names
    const routeToViewMap = {
      'training': 'edit-training',
      'events': 'edit-event'
    };

    // Use mapped view name if it exists, otherwise use baseRoute
    let viewName = routeToViewMap[baseRoute] || baseRoute;
    const view = document.querySelector(`[data-view="${viewName}"]`);

    if (!view) {
      viewName = "404";
      route = "404";
    } else if (APP.isAuthenticated) {
      // Logged-in user: redirect from guest pages to home
      if (
        baseRoute === "login" ||
        baseRoute === "register" ||
        baseRoute === "home-guest"
      ) {
        viewName = "home";
        route = "home";
      }
    } else {
      // Guest user: check if route is public
      const publicRoutes = ["home-guest", "login", "register"];
      if (baseRoute === "home") {
        viewName = "home-guest";
        route = "home-guest";
      } else if (!publicRoutes.includes(baseRoute)) {
        showToast(
          "Has de iniciar sessió per accedir a aquesta pàgina",
          "warning",
        );
        viewName = "home-guest";
        route = "home-guest";
      }
    }

    // Skip if already on this route (prevents duplicate data loading)
    const alreadyOnRoute = this.currentView === route;

    // Hide all views
    document.querySelectorAll(".view").forEach(function (v) {
      v.style.display = "none";
      v.classList.remove("active");
    });

    // Show target view
    const finalView = document.querySelector(`[data-view="${viewName}"]`);
    if (finalView) {
      finalView.style.display = "block";
      finalView.classList.add("active");
    }

    // Show/hide floating-lock-btn based on current view and admin status
    const floatingLockBtn = document.getElementById("floating-lock-btn");
    if (floatingLockBtn) {
      const isAdmin = APP.currentUser && APP.currentUser.roles && APP.currentUser.roles.includes("ADMIN");
      floatingLockBtn.style.display = (route === "planning-event" && isAdmin) ? "flex" : "none";
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

    this.currentView = route;

    // Save current route to localStorage for persistence across refreshes
    // Don't persist 404 page as it's typically server-forced
    if (route !== "404") {
      localStorage.setItem("currentRoute", route);
    }

    // Load view-specific data only if navigating to a new route
    // OR if we have an ID to load (for event/training details)
    if (!alreadyOnRoute || APP.eventIdToLoad || APP.trainingIdToLoad) {
      APP.loadViewData(viewName);
    }

    // Close mobile menu
    document.querySelector(".navbar-menu")?.classList.remove("active");

    // Scroll to top
    window.scrollTo(0, 0);
  }



})();
