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
      if (this.isRestoringHash) {
        this.isRestoringHash = false;
        return;
      }
      if (this._isInEditMode()) {
        const route = window.location.hash.substring(1) || "home";
        if (confirm("Tens canvis sense desar. Vols sortir sense desar?")) {
          APP.cancelCurrentEditMode();
          if (route.startsWith("events/")) {
            const eventId = decodeURIComponent(route.substring(7));
            if (eventId) {
              EVENTS.viewEvent(escapeHtml(eventId));
              return;
            }
          }
          this.navigateTo(route, false);
        } else {
          this.isRestoringHash = true;
          const savedRoute =
            localStorage.getItem("currentRoute") || this.currentView;
          window.location.hash = savedRoute;
        }
        return;
      }
      const route = window.location.hash.substring(1) || "home";

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
      if (route.startsWith("member-positions/")) {
        const alias = decodeURIComponent(route.substring(17));
        if (alias) {
          APP.memberPositionsAlias = alias;
          this.navigateTo("member-positions", false);
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

    const mobileBackBtn = document.getElementById("mobile-back-btn");
    if (mobileBackBtn) {
      mobileBackBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        this.navigateTo(APP.isAuthenticated ? "home" : "home-guest");
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
    if (MEMBERS.currentEditingMemberId !== null) {
      return true;
    }
    if (typeof diagramsIsDirty !== "undefined" && diagramsIsDirty) {
      return true;
    }
    return false;
  }

  goToLandingPage() {
    if (APP.isAuthenticated) {
      const hash = window.location.hash.substring(1);
      const savedRoute = localStorage.getItem("currentRoute");
      const initialRoute = hash || savedRoute || "home";
      if (initialRoute.startsWith("events/")) {
        const eventId = decodeURIComponent(initialRoute.substring(7));
        if (eventId) {
          APP.eventIdToLoad = escapeHtml(eventId);
          this.navigateTo("edit-event", false);
          return;
        }
      }
      if (initialRoute.startsWith("training/")) {
        const trainingId = decodeURIComponent(initialRoute.substring(9));
        if (trainingId) {
          APP.trainingIdToLoad = escapeHtml(trainingId);
          this.navigateTo("edit-training", false);
          return;
        }
      }
      if (initialRoute.startsWith("member-positions/")) {
        const alias = decodeURIComponent(initialRoute.substring(17));
        if (alias) {
          APP.memberPositionsAlias = alias;
          this.navigateTo("member-positions", false);
          return;
        }
      }
      this.navigateTo(initialRoute);
    } else {
      this.navigateTo("home-guest");
    }
  }

  navigateTo(route, updateHash = true) {
    const originalRoute = route;

    if (route.startsWith("member-positions/")) {
      const alias = decodeURIComponent(route.substring(17));
      if (alias) {
        APP.memberPositionsAlias = alias;
      }
    }

    if (route === "login") {
      APP.closeAllDialogs();
      const loginDialog = document.getElementById("view-login");
      if (loginDialog) {
        UI.showDialogWithBackdrop(loginDialog);
      }
      return;
    }

    if (route === "register") {
      APP.closeAllDialogs();
      const registerDialog = document.getElementById("view-register");
      if (registerDialog) {
        UI.showDialogWithBackdrop(registerDialog);
      }
      return;
    }

    if (this._isInEditMode() && route !== this.currentView) {
      if (confirm("Tens canvis sense desar. Vols sortir sense desar?")) {
        APP.cancelCurrentEditMode();
      } else {
        return;
      }
    }

    const baseRoute = route.split("/")[0];

    const routeToViewMap = {
      'training': 'edit-training',
      'events': 'edit-event'
    };

    let viewName = routeToViewMap[baseRoute] || baseRoute;
    const view = document.querySelector(`[data-view="${viewName}"]`);

    if (!view) {
      viewName = "404";
      route = "404";
    } else if (APP.isAuthenticated) {
      if (
        baseRoute === "login" ||
        baseRoute === "register" ||
        baseRoute === "home-guest"
      ) {
        viewName = "home";
        route = "home";
      }
    } else {
      const publicRoutes = ["home-guest", "login", "register"];
      if (baseRoute === "home") {
        viewName = "home-guest";
        route = "home-guest";
      } else if (!publicRoutes.includes(baseRoute)) {
        UI.showToast(
          "Has de iniciar sessió per accedir a aquesta pàgina",
          "warning",
        );
        viewName = "home-guest";
        route = "home-guest";
      }
    }

    const alreadyOnRoute = this.currentView === route;

    document.querySelectorAll(".view").forEach(function (v) {
      v.style.display = "none";
      v.classList.remove("active");
    });

    const finalView = document.querySelector(`[data-view="${viewName}"]`);
    if (finalView) {
      finalView.style.display = "block";
      finalView.classList.add("active");
    }

    const floatingLockBtn = document.getElementById("floating-lock-btn");
    if (floatingLockBtn) {
      const isAdmin = APP.currentUser && APP.currentUser.roles && APP.currentUser.roles.includes("ADMIN");
      floatingLockBtn.style.display = (route === "planning-event" && isAdmin) ? "flex" : "none";
    }

    if (route !== "planning-event" && typeof isEventEditable !== "undefined") {
      isEventEditable = false;
      isEventManuallyUnlocked = false;
    }

    document.querySelectorAll(".nav-link").forEach(function (link) {
      link.classList.remove("active");
      if (link.getAttribute("data-route") === route) {
        link.classList.add("active");
      }
    });

    const routeWasForced = originalRoute !== route;
    if (updateHash || routeWasForced) {
      window.location.hash = route;
    }

    this.currentView = route;

    if (route !== "404") {
      let routeToSave = route;
      if (route === "edit-event" && APP.eventIdToLoad) {
        routeToSave = "events/" + encodeURIComponent(APP.eventIdToLoad);
      } else if (route === "edit-training" && APP.trainingIdToLoad) {
        routeToSave = "training/" + encodeURIComponent(APP.trainingIdToLoad);
      } else if (route === "member-positions" && APP.memberPositionsAlias) {
        routeToSave = "member-positions/" + encodeURIComponent(APP.memberPositionsAlias);
      }
      localStorage.setItem("currentRoute", routeToSave);
    }

    if (!alreadyOnRoute || APP.eventIdToLoad || APP.trainingIdToLoad) {
      APP.loadViewData(viewName);
    }

    document.querySelector(".navbar-menu")?.classList.remove("active");

    const mobileBackBtn = document.getElementById("mobile-back-btn");
    if (mobileBackBtn) {
      const topLevelRoutes = ["home", "home-guest"];
      const currentBaseRoute = route.split("/")[0];
      const shouldShowBackBtn = !topLevelRoutes.includes(currentBaseRoute);
      mobileBackBtn.style.display = shouldShowBackBtn ? "" : "none";
    }

    window.scrollTo(0, 0);
  }



})();
