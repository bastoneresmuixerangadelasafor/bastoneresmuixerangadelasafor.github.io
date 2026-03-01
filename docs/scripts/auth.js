const AUTH = new (class AppAuthentication {
  constructor() {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", this._handleEmailPasswordLogin.bind(this));
    }

    const mailLoginBtn = document.getElementById("mail-login-btn");
    if (mailLoginBtn) {
      mailLoginBtn.addEventListener("click", this._handleAccessLink.bind(this));
    }

    const mailLoginGuestBtn = document.getElementById("mail-login-btn-guest");
    if (mailLoginGuestBtn) {
      mailLoginGuestBtn.addEventListener("click", this._handleAccessLink.bind(this));
    }

    const registerForm = document.getElementById("register-form");
    if (registerForm) {
      registerForm.addEventListener("submit", this._handleRegisterSubmit.bind(this));
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", this.handleLogout.bind(this));
    }

    const mobileLogoutBtn = document.getElementById("mobile-logout-btn");
    if (mobileLogoutBtn) {
      mobileLogoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector(".navbar-menu")?.classList.remove("active");
        this.handleLogout(e);
      });
    }

    const loginCloseBtn = document.getElementById("login-close-btn");
    const loginDialog = document.getElementById("view-login");
    if (loginCloseBtn) {
      loginCloseBtn.addEventListener("click", function () {
        if (loginDialog) {
          closeDialogWithBackdrop(loginDialog);
        }
      });
    }

    if (loginDialog) {
      loginDialog.addEventListener("click", function (e) {
        if (e.target === this) {
          closeDialogWithBackdrop(this);
        }
      });
    }

    const signupLink = document.getElementById("signup-link");
    if (signupLink) {
      signupLink.addEventListener("click", function (e) {
        e.preventDefault();
        const loginDialog = document.getElementById("view-login");
        if (loginDialog) {
          closeDialogWithBackdrop(loginDialog);
        }
        NAVIGATION.navigateTo("register");
      });
    }

    const registerCloseBtn = document.getElementById("register-close-btn");
    const registerDialog = document.getElementById("view-register");
    if (registerCloseBtn) {
      registerCloseBtn.addEventListener("click", function () {
        if (registerDialog) {
          closeDialogWithBackdrop(registerDialog);
        }
      });
    }

    if (registerDialog) {
      registerDialog.addEventListener("click", function (e) {
        if (e.target === this) {
          closeDialogWithBackdrop(this);
        }
      });
    }

    const loginLink = document.getElementById("login-link");
    if (loginLink) {
      loginLink.addEventListener("click", function (e) {
        e.preventDefault();
        if (registerDialog) {
          closeDialogWithBackdrop(registerDialog);
        }
        NAVIGATION.navigateTo("login");
      });
    }
  }

  _handleEmailPasswordLogin(e) {
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
        
        CACHE.saveToken({ token: result.token });
        if (submitBtn) {
          submitBtn.innerHTML = originalHtml;
          submitBtn.disabled = false;
          submitBtn.removeAttribute("aria-busy");
        }

        APP.currentUser = result.user;

        updateAuthUI();
        showToast(
          "Benvingut/da de nou, " + result.user.displayName + "!",
          "success",
        );
        
        // Close login dialog before navigating
        const loginDialog = document.getElementById("view-login");
        if (loginDialog) {
          closeDialogWithBackdrop(loginDialog);
        }
        
        NAVIGATION.navigateTo("home");
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

  _handleAccessLink(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    APP.closeAllDialogs();
    const dialog = document.getElementById("access-link-dialog");
    const emailInput = document.getElementById("access-link-email");
    
    if (!dialog) return;
    
    if (emailInput) emailInput.value = "";
    
    this._initAccessLinkDialogHandlers();
    showDialogWithBackdrop(dialog);
    if (emailInput) emailInput.focus();
  }

  _handleRegisterSubmit(e) {
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

        document.getElementById("register-form").reset();
        APP.closeAllDialogs();
        showToast(
          "Sol·licitud enviada correctament. Ens posarem en contacte amb tu!",
          "success",
        );
      })
      .catch(function (error) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        document.getElementById("register-form").reset();
        APP.closeAllDialogs();
        showToast(error || "Error en enviar la sol·licitud", "error");
        console.error("Registration error:", error);
      });
  }

  _initAccessLinkDialogHandlers() {
    const dialog = document.getElementById("access-link-dialog");
    const cancelBtn = document.getElementById("access-link-cancel-btn");
    const sendBtn = document.getElementById("access-link-send-btn");

    if (cancelBtn && !cancelBtn.dataset.initialized) {
      cancelBtn.addEventListener("click", this._closeAccessLinkDialog);
      cancelBtn.dataset.initialized = "true";
    }

    if (sendBtn && !sendBtn.dataset.initialized) {
      sendBtn.addEventListener("click", this.sendAccessLink.bind(this));
      sendBtn.dataset.initialized = "true";
    }

    // Close on backdrop click
    if (dialog && !dialog.dataset.initialized) {
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) {
          this._closeAccessLinkDialog();
        }
      });
      dialog.dataset.initialized = "true";
    }
  }

  loadProfileData() {
    if (!APP.currentUser) return;

    const avatarEl = document.getElementById("profile-avatar");
    const nameEl = document.getElementById("profile-name");
    const emailEl = document.getElementById("profile-email");
    const memberTypeEl = document.getElementById("profile-member-type");

    if (avatarEl) avatarEl.src = APP.currentUser.avatar;
    if (nameEl) nameEl.textContent = APP.currentUser.displayName;
    if (emailEl) emailEl.textContent = APP.currentUser.email;
    if (memberTypeEl)
      memberTypeEl.textContent = APP.currentUser.memberType || "";

    // Roles
    const rolesContainer = document.getElementById("profile-roles");
    const roles = APP.currentUser.roles || [];
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
    const relations = APP.currentUser.relations || [];
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
    const relatedMembers = APP.currentUser.relatedMembers || [];

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
              '<div class="related-member-card">' +
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
              "</div>" +
              '<div class="profile-links">' +
              '<a href="#member-positions/' + encodeURIComponent(member.alias) + '" class="profile-link-item" data-route="member-positions/' + encodeURIComponent(member.alias) + '">' +
              '<span class="profile-link-icon">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<rect x="3" y="3" width="7" height="7"></rect>' +
              '<rect x="14" y="3" width="7" height="7"></rect>' +
              '<rect x="14" y="14" width="7" height="7"></rect>' +
              '<rect x="3" y="14" width="7" height="7"></rect>' +
              '</svg>' +
              '</span>' +
              '<span>Posicions</span>' +
              '<span class="profile-link-arrow">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<polyline points="9 18 15 12 9 6"></polyline>' +
              '</svg>' +
              '</span>' +
              '</a>' +
              '</div>' +
              "</div>"
            );
          })
          .join("");
      } else {
        relatedMembersSection.style.display = "none";
      }
    }
  }

  _closeAccessLinkDialog() {
    closeDialogWithBackdrop("access-link-dialog");
  }

  sendAccessLink() {
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
      .then((result) => {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.textContent = "Enviar accés";
        }

        showToast(
          result.message || "Enllaç d'accés enviat al teu correu electrònic",
          "success",
        );
        this._closeAccessLinkDialog();
      })
      .catch((error) => {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.textContent = "Enviar accés";
        }
        showToast(error || "Error en enviar l'accés", "error");
        console.error("Access link error:", error);
      });
  }

  handleLogout({ message = "Has tancat la sessió", messageType = "success" } = {}) {
    // Show general loading screen
    APP.showLoading(true);

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

    const cleanupAfterLogout = () => { 
      APP.closeAllDialogs();
      this._clearUserData();

      updateAuthUI();
      NAVIGATION.navigateTo("home-guest");
      showToast(message, messageType);
      APP.showLoading(false);
    };

    // Clear server-side session
    API.logoutUser()
      .then((result) => {
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
        cleanupAfterLogout();
      })
      .catch((error) => {
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
        cleanupAfterLogout();
      });
  }

  _clearUserData() {
    // Clear app state
    APP.currentUser = null;
    NAVIGATION.currentView = "home-guest";
    CACHE.clearSession();

    // Clear localStorage
    localStorage.removeItem("currentRoute");

    // Clear members data
    MEMBERS.membersData = [];
    MEMBERS.currentEditingMemberId = null;
    MEMBERS.originalMemberData = null;
    MEMBERS.isAddingNewMember = false;
    MEMBERS.allOriginalMemberData = null;
    MEMBERS.isEditingAllMembers = false;

    // Clear members filters
    MEMBERS.membersTypeFilterValue = "";
    MEMBERS.membersActiveFilterValue = "";
    MEMBERS.membersRolsFilterValue = "";
    MEMBERS.membersAccessFilterValue = "";

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
  }

  handleLogin() {
    // Navigate to login page
    NAVIGATION.navigateTo("login");
  }

})();