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
      case "member-positions":
        loadMemberPositionsData();
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

function loadMemberPositionsData() {
  const list = document.getElementById("member-positions-list");
  const loading = document.getElementById("member-positions-loading");
  const empty = document.getElementById("member-positions-empty");
  if (!list) return;

  list.innerHTML = "";
  if (loading) loading.style.display = "flex";
  if (empty) empty.style.display = "none";

  const alias = APP.memberPositionsAlias || APP.currentUser?.alias;
  APP.memberPositionsAlias = null;
  if (!alias) {
    if (loading) loading.style.display = "none";
    if (empty) empty.style.display = "block";
    return;
  }

  var titleEl = document.querySelector("#view-member-positions .page-header h1");
  if (titleEl) {
    titleEl.textContent = alias === APP.currentUser?.alias ? "Les meues posicions" : "Posicions de " + alias;
  }

  API.getMemberPositions({ memberAlias: alias })
    .then(function (positions) {
      if (loading) loading.style.display = "none";

      var positionCardId = 0;

      DANCES.filter(function (dance) { return dance.showInPositions === true; }).forEach(function (dance) {
        var danceName = dance.name;
        var memberEntries = positions[danceName] || {};
        var dancePositions = dance.positions || [];
        var memberTags = dancePositions.filter(function (pos) {
          return String(memberEntries[pos.order]).toUpperCase() === 'SI';
        }).map(function (pos) { return pos.tag; });
        var inProgressTags = dancePositions.filter(function (pos) {
          return String(memberEntries[pos.order]).toUpperCase() === 'EN PROGRES';
        }).map(function (pos) { return pos.tag; });
        var diagramColors = dance.diagram || { backgroundColor: {}, textColor: {} };
        var rows = dance.structure ? dance.structure.rows : 2;
        var cols = dance.structure ? dance.structure.columns : 2;

        var cardId = positionCardId++;
        var canvasId = "position-canvas-" + cardId;

        var legendHtml = "";
        var seenLabels = {};
        dancePositions.forEach(function (pos) {
          if (seenLabels[pos.positionType.label]) return;
          seenLabels[pos.positionType.label] = true;
          var color = (diagramColors.backgroundColor && diagramColors.backgroundColor[pos.positionType.label]) || "#808080";
          legendHtml += '<div class="diagram-legend-item">' +
            '<span class="legend-color-box" style="background: ' + color + ';"></span>' +
            '<span>' + pos.positionType.label + '</span>' +
            '</div>';
        });
        var showLegend = Object.keys(seenLabels).length > 1;

        var forms = dance.structure && dance.structure.forms ? dance.structure.forms : ['grid'];
        var formToggleHtml = '';
        if (forms.length >= 2) {
          formToggleHtml = '<div class="diagram-form-toggle">';
          forms.forEach(function (form, idx) {
            var activeClass = idx === 0 ? ' active' : '';
            var label = form === 'radial' ? '\u25EF' : '\u25A6';
            formToggleHtml += '<button type="button" class="form-toggle-btn' + activeClass + '" data-canvas-id="' + canvasId + '" data-form="' + form + '" title="' + form + '">' + label + '</button>';
          });
          formToggleHtml += '</div>';
        }

        var card = document.createElement("div");
        card.className = "position-card";
        card.innerHTML =
          '<div class="diagram-header">' +
            '<div class="diagram-title-row">' +
              '<h3 class="diagram-title">' + danceName + '</h3>' +
            '</div>' +
            '<div class="diagram-legend" style="' + (showLegend ? '' : 'display:none;') + '">' +
              legendHtml +
            '</div>' +
          '</div>' +
          '<div class="diagrams-canvas-container">' +
            '<div class="diagrams-canvas-wrapper">' +
              formToggleHtml +
              '<canvas id="' + canvasId + '" width="600" height="250"></canvas>' +
            '</div>' +
          '</div>';

        list.appendChild(card);

        var positionDrawOpts = {
          canvasId: canvasId,
          rows: rows,
          cols: cols,
          positions: dancePositions,
          diagramColors: diagramColors,
          highlightTags: memberTags,
          inProgressTags: inProgressTags,
          form: forms[0]
        };
        drawPositionDiagram(positionDrawOpts);

        if (forms.length >= 2) {
          card.querySelectorAll('.form-toggle-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var selectedForm = btn.dataset.form;
              btn.closest('.diagram-form-toggle').querySelectorAll('.form-toggle-btn').forEach(function (b) {
                b.classList.toggle('active', b.dataset.form === selectedForm);
              });
              positionDrawOpts.form = selectedForm;
              drawPositionDiagram(positionDrawOpts);
            });
          });
        }
      });
    })
    .catch(function (error) {
      console.error("Failed to load positions:", error);
      if (loading) loading.style.display = "none";
      list.innerHTML = '<div class="empty-state"><p>No s\'han pogut carregar les posicions.</p></div>';
    });
}

function drawRadialPositionDiagram(ctx, canvas, rows, cols, positions, diagramColors, highlightTags, inProgressTags) {
  var rl = calcRadialPositionLayout(canvas, rows, cols);
  if (canvas.height !== Math.round(rl.requiredHeight)) {
    canvas.height = Math.round(rl.requiredHeight);
  }

  var primaryColor = getComputedStyle(document.documentElement).getPropertyValue("--primary-color").trim() || "#6366f1";

  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      var order = row * cols + col + 1;
      var pos = positions.find(function (p) { return p.order === order; });
      var tag = pos ? pos.tag : "";
      var label = pos && pos.positionType ? pos.positionType.label : "";
      var isHighlighted = highlightTags.indexOf(tag) !== -1;
      var isInProgress = inProgressTags.indexOf(tag) !== -1;

      var bgColor = "#808080";
      if (label && diagramColors.backgroundColor && diagramColors.backgroundColor[label]) {
        bgColor = diagramColors.backgroundColor[label];
      }
      var textColor = "#FFFFFF";
      if (label && diagramColors.textColor && diagramColors.textColor[label]) {
        textColor = diagramColors.textColor[label];
      }

      var cellCenterX = rl.centerX;
      var cellCenterY = rl.centerY - rl.coupleHeight / 2 + row * (rl.cellHeight + rl.coupleGap) + rl.cellHeight / 2;
      var x = cellCenterX - rl.cellWidth / 2;
      var y = cellCenterY - rl.cellHeight / 2;

      if (!isHighlighted && !isInProgress) {
        ctx.globalAlpha = 0.3;
      }

      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, rl.cellWidth, rl.cellHeight);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = Math.max(2, 4 * rl.scale);
      ctx.strokeRect(x, y, rl.cellWidth, rl.cellHeight);

      if (isHighlighted) {
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = Math.max(3, 6 * rl.scale);
        ctx.strokeRect(x, y, rl.cellWidth, rl.cellHeight);

        var cx = x + rl.cellWidth / 2;
        var cy = y + rl.cellHeight / 2;
        var r = Math.min(rl.cellWidth, rl.cellHeight) * 0.32;

        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 6 * rl.scale;
        ctx.shadowOffsetY = 2 * rl.scale;

        var outerRing = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
        outerRing.addColorStop(0, "#C9A84C");
        outerRing.addColorStop(0.5, "#F5D77A");
        outerRing.addColorStop(1, "#A67C2E");
        ctx.fillStyle = outerRing;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = "transparent";

        var innerR = r * 0.78;
        var innerGrad = ctx.createLinearGradient(cx, cy - innerR, cx, cy + innerR);
        innerGrad.addColorStop(0, "#FFE8A0");
        innerGrad.addColorStop(0.35, "#FFD54F");
        innerGrad.addColorStop(0.65, "#FFCA28");
        innerGrad.addColorStop(1, "#F0B400");
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(160, 120, 30, 0.35)";
        ctx.lineWidth = Math.max(1, 1.5 * rl.scale);
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();

        var ts = r * 0.48;
        ctx.strokeStyle = "#6D4C00";
        ctx.lineWidth = Math.max(2.5, 4.5 * rl.scale);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(cx - ts * 0.55, cy + ts * 0.05);
        ctx.lineTo(cx - ts * 0.05, cy + ts * 0.5);
        ctx.lineTo(cx + ts * 0.65, cy - ts * 0.45);
        ctx.stroke();

        ctx.restore();
      }
      if (isInProgress) {
        var iconS = Math.min(rl.cellWidth, rl.cellHeight) * 0.6;
        var fontSize = Math.round(iconS);
        ctx.save();
        ctx.font = fontSize + "px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("\uD83C\uDFCB\uFE0F\u200D\u2640\uFE0F", x + rl.cellWidth / 2, y + rl.cellHeight / 2);
        ctx.restore();
      }
    }
  }

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(1, 2 * rl.scale);
  ctx.fillRect(rl.placaX, rl.placaY, rl.placaWidth, rl.placaHeight);
  ctx.strokeRect(rl.placaX, rl.placaY, rl.placaWidth, rl.placaHeight);
  var placaFontSize = Math.max(12, Math.round(20 * rl.scale));
  ctx.fillStyle = "#000";
  ctx.font = "bold " + placaFontSize + "px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PLAÇA", rl.placaX + rl.placaWidth / 2, rl.placaY + rl.placaHeight / 2);
  ctx.restore();
}

function calcRadialPositionLayout(canvas, rows, cols) {
  var baseCellWidth = 100;
  var baseCellHeight = 50;
  var baseCoupleGap = 8;
  var baseCoupleHeight = baseCellHeight * rows + baseCoupleGap * (rows - 1);
  var availableWidth = canvas.width - 40;
  var scale = Math.min(1, availableWidth / (baseCellWidth + 40));
  var cellWidth = baseCellWidth * scale;
  var cellHeight = baseCellHeight * scale;
  var coupleGap = baseCoupleGap * scale;
  var coupleHeight = cellHeight * rows + coupleGap * (rows - 1);
  var centerX = canvas.width / 2;
  var centerY = 20 + coupleHeight / 2;
  var placaHeight = Math.max(25, 40 * scale);
  var placaY = centerY + coupleHeight / 2 + 60 * scale;
  var placaWidth = cellWidth;
  var placaX = centerX - placaWidth / 2;
  var requiredHeight = placaY + placaHeight + 15;
  return {
    cellWidth: cellWidth, cellHeight: cellHeight, coupleGap: coupleGap, coupleHeight: coupleHeight,
    centerX: centerX, centerY: centerY,
    placaX: placaX, placaY: placaY, placaWidth: placaWidth, placaHeight: placaHeight,
    scale: scale, requiredHeight: requiredHeight
  };
}

function drawPositionDiagram(opts) {
  var canvas = document.getElementById(opts.canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var rows = opts.rows || 2;
  var cols = opts.cols || 2;
  var positions = opts.positions || [];
  var diagramColors = opts.diagramColors || { backgroundColor: {}, textColor: {} };
  var highlightTags = opts.highlightTags || [];
  var inProgressTags = opts.inProgressTags || [];
  var activeForm = opts.form || 'grid';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (activeForm === 'radial') {
    drawRadialPositionDiagram(ctx, canvas, rows, cols, positions, diagramColors, highlightTags, inProgressTags);
    return;
  }

  var layout = calcDiagramLayout(canvas, 1, rows, cols);
  var squareWidth = layout.squareWidth;
  var squareHeight = layout.squareHeight;
  var squareSpacingX = layout.squareSpacingX;
  var squareSpacingY = layout.squareSpacingY;
  var gridWidth = layout.gridWidth;
  var gridHeight = layout.gridHeight;
  var offsetX0 = layout.offsetX0;
  var offsetY = layout.offsetY;
  var scale = layout.scale;

  var placaHeight = Math.max(25, 40 * scale);
  var placaY = offsetY + gridHeight + 60 * scale;
  var requiredHeight = placaY + placaHeight + 15;
  if (canvas.height !== Math.round(requiredHeight)) {
    canvas.height = Math.round(requiredHeight);
  }

  var primaryColor = getComputedStyle(document.documentElement).getPropertyValue("--primary-color").trim() || "#6366f1";

  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      var order = row * cols + col + 1;
      var pos = positions.find(function (p) { return p.order === order; });
      var tag = pos ? pos.tag : "";
      var label = pos && pos.positionType ? pos.positionType.label : "";
      var isHighlighted = highlightTags.indexOf(tag) !== -1;
      var isInProgress = inProgressTags.indexOf(tag) !== -1;

      var bgColor = "#808080";
      if (label && diagramColors.backgroundColor && diagramColors.backgroundColor[label]) {
        bgColor = diagramColors.backgroundColor[label];
      }

      var textColor = "#FFFFFF";
      if (label && diagramColors.textColor && diagramColors.textColor[label]) {
        textColor = diagramColors.textColor[label];
      }

      var x = offsetX0 + col * (squareWidth + squareSpacingX);
      var y = offsetY + row * (squareHeight + squareSpacingY);

      if (!isHighlighted && !isInProgress) {
        ctx.globalAlpha = 0.3;
      }

      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, squareWidth, squareHeight);

      ctx.globalAlpha = 1;

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = Math.max(2, 4 * scale);
      ctx.strokeRect(x, y, squareWidth, squareHeight);

      if (isHighlighted) {
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = Math.max(3, 6 * scale);
        ctx.strokeRect(x, y, squareWidth, squareHeight);

        var cx = x + squareWidth / 2;
        var cy = y + squareHeight / 2;
        var r = Math.min(squareWidth, squareHeight) * 0.32;

        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 6 * scale;
        ctx.shadowOffsetY = 2 * scale;

        var outerRing = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
        outerRing.addColorStop(0, "#C9A84C");
        outerRing.addColorStop(0.5, "#F5D77A");
        outerRing.addColorStop(1, "#A67C2E");
        ctx.fillStyle = outerRing;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = "transparent";

        var innerR = r * 0.78;
        var innerGrad = ctx.createLinearGradient(cx, cy - innerR, cx, cy + innerR);
        innerGrad.addColorStop(0, "#FFE8A0");
        innerGrad.addColorStop(0.35, "#FFD54F");
        innerGrad.addColorStop(0.65, "#FFCA28");
        innerGrad.addColorStop(1, "#F0B400");
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(160, 120, 30, 0.35)";
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();

        var ts = r * 0.48;
        ctx.strokeStyle = "#6D4C00";
        ctx.lineWidth = Math.max(2.5, 4.5 * scale);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(cx - ts * 0.55, cy + ts * 0.05);
        ctx.lineTo(cx - ts * 0.05, cy + ts * 0.5);
        ctx.lineTo(cx + ts * 0.65, cy - ts * 0.45);
        ctx.stroke();

        ctx.restore();
      }
      if (isInProgress) {
        var iconS = Math.min(squareWidth, squareHeight) * 0.6;
        var fontSize = Math.round(iconS);

        ctx.save();
        ctx.font = fontSize + "px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🏋️‍♀️", x + squareWidth / 2, y + squareHeight / 2);
        ctx.restore();
      }    }
  }

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.fillRect(offsetX0, placaY, gridWidth, placaHeight);
  ctx.strokeRect(offsetX0, placaY, gridWidth, placaHeight);
  var placaFontSize = Math.max(12, Math.round(20 * scale));
  ctx.fillStyle = "#000";
  ctx.font = "bold " + placaFontSize + "px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PLAÇA", offsetX0 + gridWidth / 2, placaY + placaHeight / 2);
  ctx.restore();
}








