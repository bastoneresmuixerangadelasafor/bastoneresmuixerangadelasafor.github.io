const EVENTS = new (class EventsManager {
  constructor() {
  }

  resetEventsForm() {
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

    const danceSelectorSection = document.getElementById(
      "dance-selector-section",
    );
    if (danceSelectorSection) {
      danceSelectorSection.style.display = "none";
    }

    const diagramsList = document.getElementById("diagrams-list");
    if (diagramsList) {
      diagramsList.innerHTML = "";
    }

    if (typeof diagrams !== "undefined") {
      diagrams.length = 0;
    }
    if (typeof diagramIdCounter !== "undefined") {
      diagramIdCounter = 0;
    }

    if (typeof diagramsIsDirty !== "undefined") {
      diagramsIsDirty = false;
    }
    if (typeof isEventManuallyUnlocked !== "undefined") {
      isEventManuallyUnlocked = false;
    }
    if (typeof isEventEditable !== "undefined") {
      isEventEditable = true;
    }

    const attendanceSection = document.getElementById("event-member-attendance-section");
    if (attendanceSection) {
      attendanceSection.style.display = "none";
    }

    const attendanceList = document.getElementById("event-member-attendance-list");
    if (attendanceList) {
      attendanceList.innerHTML = "";
      attendanceList.classList.add("collapsed");
    }

    const attendanceToggle = document.getElementById("event-attendance-toggle");
    if (attendanceToggle) {
      const toggleArrow = attendanceToggle.querySelector(".toggle-arrow");
      if (toggleArrow) toggleArrow.textContent = "▶";
      attendanceToggle.setAttribute("aria-expanded", "false");
    }
  }

  loadPlanningEventData() {
    const container = document.getElementById("planning-event-list");
    if (!container) return;

    container.innerHTML = `
          <div class="events-loading">
          <div class="spinner"></div>
          <span>Carregant actuacions...</span>
          </div>
      `;

    API.getEvents({ onBackgroundUpdate: (events) => EVENTS.renderPlanningEventsList(events) })
      .then(function (events) {
        EVENTS.renderPlanningEventsList(events);
      })
      .catch(function (error) {
        console.error("Failed to load events:", error);
        container.innerHTML = `
                  <div class="events-empty">
                  <div class="events-empty-icon">⚠️</div>
                  <p>No s'han pogut carregar les actuacions</p>
                  </div>
              `;
        
        const refreshBtn = document.getElementById("refresh-event-btn");
        if (refreshBtn) {
          refreshBtn.style.display = "block";
        }
      });
  }

  renderPlanningEventsList(events) {
    const container = document.getElementById("planning-event-list");
    const pastEventsContainer = document.getElementById("past-event-list");
    const pastEventsToggle = document.getElementById("past-event-toggle");
    const pastEventsCount = document.getElementById("past-event-count");

    if (!container) return;

    if (!events || events.length === 0) {
      const isAdmin = APP.currentUser && (APP.currentUser.roles || []).includes("ADMIN");
      const createHint = isAdmin ? '<p>Crea una nova actuació per començar!</p>' : '';
      container.innerHTML = `
      <div class="events-empty">
      <div class="events-empty-icon">📅</div>
      <p>No hi ha actuacions programades</p>
      ${createHint}
      </div>
      `;
      if (pastEventsContainer) pastEventsContainer.innerHTML = "";
      
      const refreshBtn = document.getElementById("refresh-event-btn");
      if (refreshBtn) {
        refreshBtn.style.display = "block";
      }
      return;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const upcomingEvents = [];
    const pastEvents = [];

    const isAdmin = APP.currentUser && (APP.currentUser.roles || []).includes("ADMIN");

    events.forEach(function (event) {
      const showEvent = event.visible || isAdmin;
      if (!showEvent) return;

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

    function createEventCardHTML(event) {
        const formattedDate = EVENTS.formatEventDate(event.date);
        let meetingPlaceHtml = "";
        if (event.meetingPlace) {
          if (event.placeUrl) {
            meetingPlaceHtml = `<a href="${escapeHtml(event.placeUrl)}" target="_blank" class="event-card-place" onclick="event.stopPropagation()">📍 ${escapeHtml(event.meetingPlace)} 🗺️</a>`;
          } else {
            meetingPlaceHtml = `<span class="event-card-place">📍 ${escapeHtml(event.meetingPlace)}</span>`;
          }
        }

        let confirmationStatusHtml = "";
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const eventDate = new Date(event.date);
        const isPastEvent = eventDate < now;
        const shouldShowConfirmation = !isPastEvent || event.attendees !== null;

        if (APP.currentUser && shouldShowConfirmation) {
          const relatedMembers = APP.currentUser.relatedMembers || [];
          const hasRelatedMembers = relatedMembers.length > 0;

          function generateEventConfirmationSection(memberAlias, memberName, isRelatedMember, showName) {
            const isConfirmed = (event.attendees || []).some(function(attendee) {
              return attendee === memberAlias;
            });
            const isRejected = (event.rejections || []).some(function(rejector) {
              return rejector === memberAlias;
            });

            let statusClass = 'event-status-indicator not-confirmed';
            let statusText = '? No confirmat';
            let button1Html = '';
            let buttonHtml = '';

            if (isPastEvent) {
              if (isConfirmed) {
                statusClass = 'event-status-indicator confirmed';
                statusText = `✓ ${isRelatedMember ? 'Ha assistit' : 'Has assistit'}`;
              } else {
                statusClass = 'event-status-indicator not-attending';
                statusText = `✕ ${isRelatedMember ? 'No ha assistit' : 'No has assistit'}`;
              }
            } else {
              const confirmFn = isRelatedMember ?
                `EVENTS.confirmEventRelatedMemberAttendance('${escapeJsString(event.id)}', '${escapeJsString(memberAlias)}')` :
                `EVENTS.confirmEventAttendance('${escapeJsString(event.id)}')`;
              const rejectFn = isRelatedMember ?
                `EVENTS.rejectEventRelatedMemberAttendance('${escapeJsString(event.id)}', '${escapeJsString(memberAlias)}')` :
                `EVENTS.rejectEventAttendance('${escapeJsString(event.id)}')`;

              const noAttendingText = isRelatedMember ? 'No assistirà' : 'No assistiré';
              const noAttendingTitle = isRelatedMember ? 'No assistirà' : 'No assistiré';

              if (isConfirmed) {
                statusClass = 'event-status-indicator confirmed';
                statusText = '✔\uFE0E Confirmat';
                buttonHtml = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="${rejectFn}" title="${noAttendingTitle}">✕︎ ${noAttendingText}</button>`;
              } else if (isRejected) {
                statusClass = 'event-status-indicator not-attending';
                statusText = `✕\uFE0E ${noAttendingText}`;
                buttonHtml = `<button type="button" class="btn btn-xs btn-outline-success" onclick="${confirmFn}" title="Confirmar assistència">✔︎ Confirmar</button>`;
              } else {
                buttonHtml = `<button type="button" class="btn btn-xs btn-outline-success" onclick="${confirmFn}" title="Confirmar assistència">✔︎ Confirmar</button><button type="button" class="btn btn-xs btn-outline-danger" onclick="${rejectFn}" title="${noAttendingTitle}">✕︎ ${noAttendingText}</button>`;
              }
            }

            const sectionClass = isRelatedMember ? 'event-confirmation-section related-member' : 'event-confirmation-section';
            const nameHtml = showName ? `<span class="event-confirmation-member-name">${escapeHtml(memberName)}</span>` : '';
            const buttonsHtml = isPastEvent ? '' : `<div class="event-confirmation-buttons" onclick="event.stopPropagation()">${buttonHtml}</div>`;

            return `
              <div class="${sectionClass}" data-event-id="${escapeHtml(event.id)}" data-member-alias="${escapeHtml(memberAlias)}">
                ${nameHtml}
                <span class="${statusClass}">${statusText}</span>
                ${buttonsHtml}
              </div>`;
          }

          const currentUserName = APP.currentUser.displayName || APP.currentUser.alias || 'Tu';
          confirmationStatusHtml = generateEventConfirmationSection(APP.currentUser.alias, currentUserName, false, hasRelatedMembers);

          relatedMembers.forEach(function(rm) {
            if (rm.alias) {
              const rmName = rm.name || rm.alias;
              confirmationStatusHtml += generateEventConfirmationSection(rm.alias, rmName, true, true);
            }
          });
        }

        let visibilityIcon = '';
        if (isAdmin) {
          if (!event.visible) {
            visibilityIcon = '<svg class="event-hidden-icon" title="No visible per als membres" onclick="event.stopPropagation(); EVENTS.makeEventVisible(\'' + escapeJsString(event.name) + '\')" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
          } else {
            visibilityIcon = '<svg class="event-visible-icon" title="Visible per als membres" onclick="event.stopPropagation(); EVENTS.makeEventHidden(\'' + escapeJsString(event.name) + '\')" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
          }
        }

        const unconfirmedIcon = !event.confirmed ? '<svg class="event-unconfirmed-icon" title="Actuació no confirmada" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 5.58 2 10c0 2.72 1.64 5.12 4.14 6.56L4 22l5.1-2.55C10.03 19.81 11 20 12 20c5.52 0 10-3.58 10-8S17.52 2 12 2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><text x="12" y="14" text-anchor="middle" font-size="12" font-weight="bold" fill="currentColor" font-family="sans-serif">?</text></svg>' : '';

        return `
        <div class="event-card" data-event-id="${escapeHtml(event.id)}" onclick="EVENTS.viewEvent('${escapeJsString(event.id)}')">
        ${visibilityIcon}
        <div class="event-card-info">
        <span class="event-card-name">${event.name}${unconfirmedIcon}</span>
        <span class="event-card-date">${formattedDate}</span>
        ${meetingPlaceHtml}
        ${confirmationStatusHtml}
        </div>
        </div>
        `;
    }

    if (upcomingEvents.length === 0) {
      const createHint = isAdmin ? '<p>Crea una nova actuació per començar!</p>' : '';
      container.innerHTML = `
      <div class="events-empty">
      <div class="events-empty-icon">📅</div>
      <p>No hi ha actuacions programades</p>
      ${createHint}
      </div>
      `;
    } else {
      upcomingEvents.sort(function (a, b) {
        const dateA = a.date ? new Date(a.date).getTime() : Infinity;
        const dateB = b.date ? new Date(b.date).getTime() : Infinity;
        return dateA - dateB;
      });

      const upcomingHTML = upcomingEvents.map(createEventCardHTML).join("");
      container.innerHTML = upcomingHTML;
    }

    if (pastEventsContainer) {
      if (pastEvents.length === 0) {
        pastEventsContainer.innerHTML =
          '<div class="past-event-empty">No hi ha actuacions passades</div>';
      } else {
        const pastHTML = pastEvents.map(createEventCardHTML).join("");
        pastEventsContainer.innerHTML = pastHTML;
      }
    }

    if (pastEventsCount) {
      pastEventsCount.textContent = pastEvents.length;
    }

    if (pastEventsToggle) {
      if (pastEvents.length === 0) {
        pastEventsToggle.style.display = "none";
      } else {
        pastEventsToggle.style.display = "flex";
      }
    }

    if (pastEventsToggle && !pastEventsToggle.dataset.initialized) {
      pastEventsToggle.addEventListener("click", function () {
        const content = pastEventsContainer;
        pastEventsToggle.classList.toggle("active");
        if (content.style.display === "none") {
          content.style.display = "";
        } else {
          content.style.display = "none";
        }
      });
      pastEventsToggle.dataset.initialized = "true";
    }

    const refreshBtn = document.getElementById("refresh-event-btn");
    if (refreshBtn) {
      refreshBtn.style.display = "block";
    }
  }

  formatEventDate(date) {
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

  loadEventData(eventId) {
    if (!eventId) {
      UI.showToast("ID d'desenvolupament no vàlid", "error");
      return;
    }

    APP.currentEventId = eventId;

    if (typeof isEventManuallyUnlocked !== "undefined") {
      isEventManuallyUnlocked = false;
    }
    if (typeof isEventEditable !== "undefined") {
      isEventEditable = true;
    }
    
    APP.showLoading(true);

    API.getEventById({ eventId })
      .then(function (eventData) {
        APP.showLoading(false);

        if (!eventData) {
          UI.showToast("No s'ha trobat l'esdeveniment", "error");
          return;
        }
        APP.currentEventData = eventData;
        const canonicalEventId = eventData.id || eventId;
        const eventHash = "events/" + encodeURIComponent(canonicalEventId);
        localStorage.setItem("currentRoute", eventHash);

        const eventNameInput = document.getElementById("event-name-input");
        const eventDatetimeInput = document.getElementById(
          "event-datetime-input",
        );
        const eventMeetingPlaceInput = document.getElementById(
          "event-meeting-place-input",
        );
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
          if (!eventData.confirmed) {
            eventNameDisplay.innerHTML = escapeHtml(eventData.name || "") + '<svg class="event-unconfirmed-icon" title="Actuació no confirmada" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 5.58 2 10c0 2.72 1.64 5.12 4.14 6.56L4 22l5.1-2.55C10.03 19.81 11 20 12 20c5.52 0 10-3.58 10-8S17.52 2 12 2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><text x="12" y="14" text-anchor="middle" font-size="12" font-weight="bold" fill="currentColor" font-family="sans-serif">?</text></svg>';
          }
        }

        if (eventDatetimeInput && eventData.datetime) {
          try {
            let dateValue = eventData.datetime;
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

        if (eventMeetingPlaceInput) {
          eventMeetingPlaceInput.value = eventData.meetingPlace || "";
        }
        if (eventMeetingPlaceDisplay) {
          eventMeetingPlaceDisplay.textContent = eventData.meetingPlace || "";
        }

        eventNameInput.dispatchEvent(new Event("input"));
        eventDatetimeInput.dispatchEvent(new Event("input"));

        EVENTS.prepareEventAttendanceSection();
        EVENTS.initializeEventAttendanceToggle();

        setTimeout(function () {
          EVENTS.loadEventDiagrams(eventData);
        }, 500);

        UI.showToast("Esdeveniment carregat", "success");
      })
      .catch(function (error) {
        APP.showLoading(false);
        console.error("Error loading event:", error);
        UI.showToast("Error carregant l'esdeveniment", "error");
      });
  }

  viewEvent(eventId) {
    if (!eventId) return;
    APP.eventIdToLoad = escapeHtml(eventId);
    window.location.hash = "events/" + encodeURIComponent(eventId);
  }

  makeEventVisible(eventName) {
    if (!confirm("Vols fer l'actuació visible a tots els membres?")) return;
    API.setEventVisibility({ eventName: eventName, visible: true })
      .then(function () {
        CACHE.saveEvents({ events: null });
        EVENTS.loadPlanningEventData();
      })
      .catch(function (error) {
        console.error('Failed to make event visible:', error);
        alert("No s'ha pogut fer visible l'actuació");
      });
  }

  makeEventHidden(eventName) {
    if (!confirm("Segur que vols ocultar l'actuació?")) return;
    API.setEventVisibility({ eventName: eventName, visible: false })
      .then(function () {
        CACHE.saveEvents({ events: null });
        EVENTS.loadPlanningEventData();
      })
      .catch(function (error) {
        console.error('Failed to hide event:', error);
        alert("No s'ha pogut ocultar l'actuació");
      });
  }


  renderDiagrams(eventData) {
    if (typeof DANCES === "undefined" || !Array.isArray(DANCES) || DANCES.length === 0) {
      return false;
    }

    if (!eventData || !eventData.diagrams) {
      return false;
    }

    const diagramsList = document.getElementById("diagrams-list");
    if (!diagramsList) {
      return false;
    }

    eventData.diagrams.forEach((diagramData) => {
      const danceInfo = DANCES.find(function (d) {
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
        forms: danceInfo && danceInfo.structure && danceInfo.structure.forms ? danceInfo.structure.forms : ['grid'],
        backup: diagramData.backup || []
      };

      if (danceInfo && danceInfo.positions) {
        newDiagram.positions = danceInfo.positions;
      }

      diagrams.push(newDiagram);

      const element = createDiagramElement(newDiagram);
      diagramsList.appendChild(element);

      const canvas = document.getElementById(
        "diagram-canvas-" + newDiagram.id,
      );
      if (canvas) {
        this.setupCanvasClickHandlerForDiagram(newDiagram.id);
      }

      drawDiagram(newDiagram);
    });

    if (typeof diagramsIsDirty !== "undefined") {
      diagramsIsDirty = false;
    }

    if (typeof applyEditableState !== "undefined") {
      applyEditableState();
    }

    if (typeof updateMemberPositionOverlay !== "undefined") {
      updateMemberPositionOverlay();
    }

    return true;
  }

  loadEventDiagrams(eventData) {
    if (!eventData || !eventData.diagrams) return;

    const diagramsList = document.getElementById("diagrams-list");
    if (!diagramsList) return;

    diagramsList.innerHTML = "";

    if (typeof diagrams !== "undefined") {
      diagrams.length = 0;
      diagramIdCounter = 0;
    }

    this.renderDiagrams(eventData);
  }

  setupCanvasClickHandlerForDiagram(diagramId) {
    const canvas = document.getElementById("diagram-canvas-" + diagramId);
    if (!canvas) return;

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

      const forms = diagram.forms || ['grid'];
      const activeForm = diagram.activeForm || forms[0];
      if (activeForm === 'radial') {
        const rl = calcRadialDiagramLayout(canvas, groupCount, rows, cols);
        for (let g = 0; g < groupCount; g++) {
          const angle = -Math.PI / 2 + (2 * Math.PI * g) / groupCount;
          const groupCenterX = rl.centerX + rl.radius * Math.cos(angle);
          const groupCenterY = rl.centerY + rl.radius * Math.sin(angle);
          for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
              const cx = groupCenterX;
              const cy = groupCenterY - rl.coupleHeight / 2 + row * (rl.cellHeight + rl.coupleGap) + rl.cellHeight / 2;
              const cellX = cx - rl.cellWidth / 2;
              const cellY = cy - rl.cellHeight / 2;
              if (clickX >= cellX && clickX <= cellX + rl.cellWidth && clickY >= cellY && clickY <= cellY + rl.cellHeight) {
                const idx = row * cols + col;
                window.selectedDiagramId = diagramId;
                window.selectedGroup = g;
                window.selectedSquare = idx;
                EVENTS.populatePersonListForDiagram(diagram, g, idx);
                return;
              }
            }
          }
        }
        return;
      }

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

          window.selectedDiagramId = diagramId;
          window.selectedGroup = g;
          window.selectedSquare = idx;

          EVENTS.populatePersonListForDiagram(diagram, g, idx);
          return;
        }
      }
    });
  }

  populatePersonListForDiagram(diagram, g, squareIdx) {
    APP.closeAllDialogs();
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

    let isEventInPast = false;
    if (eventDatetimeInput && eventDatetimeInput.value) {
      const eventDate = new Date(eventDatetimeInput.value);
      const now = new Date();
      isEventInPast = eventDate < now;
    }

    const personAliases = MEMBERS.membersData
      .filter(function (m) {
        return isEventInPast || m.active;
      })
      .map(function (m) {
        return m.alias;
      })
      .filter(Boolean);
    window.currentOptions = personAliases.filter(function (name) {
      return !usedNames.includes(name) || diagram.groups[g][squareIdx] === name;
    });

    personList.innerHTML = "";

    if (window.currentOptions.length === 0) {
      personCombo.style.display = "none";
      personList.classList.remove('open');
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

    const positions = diagram.positions || [];
    const order = squareIdx + 1;
    const pos = positions.find(function (p) { return p.order === order; });
    const groupLetter = String.fromCharCode(65 + g);
    const diagramColors = diagram.diagram || {};
    const blockName = diagramColors.blockName || 'Grup';

    let positionInfoText = blockName + ' ' + groupLetter;
    if (pos && pos.specifications) {
      positionInfoText = pos.specifications;
    } else if (pos && pos.positionType && pos.positionType.label) {
      positionInfoText = pos.positionType.label;
    }

    const positionInfo = document.getElementById('position-info');
    if (positionInfo) {
      positionInfo.textContent = positionInfoText;
      positionInfo.style.display = 'block';
    }

    if (dialog) {
      UI.showDialogWithBackdrop(dialog);
    }
  }

  refreshPlanningEvents() {
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
        EVENTS.renderPlanningEventsList(events);
        UI.showToast("Llista actualitzada", "success");
      })
      .catch(function (error) {
        if (refreshBtn) {
          refreshBtn.classList.remove("refreshing");
          refreshBtn.disabled = false;
        }
        UI.showToast("Error actualitzant la llista", "error");
      });
  }

  prepareEventAttendanceSection() {
    const isAdmin = APP.currentUser && (APP.currentUser.roles || []).includes("ADMIN");
    const attendanceSection = document.getElementById("event-member-attendance-section");
    const attendanceList = document.getElementById("event-member-attendance-list");
    const attendanceToggle = document.getElementById("event-attendance-toggle");
    
    if (!attendanceSection || !attendanceList) {
      return;
    }
    
    if (isAdmin) {
      attendanceSection.style.display = "";
      attendanceList.classList.add("collapsed");
      if (attendanceToggle) {
        const toggleArrow = attendanceToggle.querySelector(".toggle-arrow");
        if (toggleArrow) toggleArrow.textContent = "▶";
        attendanceToggle.setAttribute("aria-expanded", "false");
      }
      attendanceList.innerHTML = "";

      const countSpan = document.getElementById("event-attendance-count");
      if (countSpan && APP.currentEventData) {
        const attendCount = (APP.currentEventData.attendees || []).length;
        const rejectCount = (APP.currentEventData.rejections || []).length;
        countSpan.textContent = `${attendCount} SI / ${rejectCount} NO`;
      }
    } else {
      attendanceSection.style.display = "none";
    }
  }

  initializeEventAttendanceToggle() {
    const attendanceToggle = document.getElementById("event-attendance-toggle");
    
    if (attendanceToggle && !attendanceToggle.dataset.initialized) {
      attendanceToggle.addEventListener("click", function () {
        const attendanceList = document.getElementById("event-member-attendance-list");
        const toggleArrow = attendanceToggle.querySelector(".toggle-arrow");
        
        if (attendanceList) {
          const isCollapsed = attendanceList.classList.contains("collapsed");
          
          if (isCollapsed) {
            EVENTS.loadEventMembersAttendance(APP.currentEventData);
          }
          
          attendanceList.classList.toggle("collapsed");
          toggleArrow.textContent = attendanceList.classList.contains("collapsed") ? "▶" : "▼";
          attendanceToggle.setAttribute("aria-expanded", !attendanceList.classList.contains("collapsed"));
        }
      });
      attendanceToggle.dataset.initialized = "true";
    }
  }

  loadEventMembersAttendance(eventData) {
    if (!eventData) {
      eventData = APP.currentEventData;
    }
    
    const attendanceList = document.getElementById("event-member-attendance-list");
    if (!attendanceList) return;
    
    attendanceList.innerHTML = '<div class="event-member-attendance-loading" id="event-members-loader"><div class="spinner"></div><span>Carregant membres...</span></div>';
    
    API.getMembers()
      .then(function (members) {
        if (Array.isArray(members)) {
          MEMBERS.membersData = members;
          EVENTS.displayEventMemberAttendanceList(eventData);
        }
      })
      .catch(function (error) {
        console.error("Error loading members for event:", error);
        attendanceList.innerHTML = '<div class="event-member-attendance-loading">Error al carregar membres</div>';
      });
  }

  displayEventMemberAttendanceList(eventData) {
    const isAdmin = APP.currentUser && (APP.currentUser.roles || []).includes("ADMIN");
    const attendanceSection = document.getElementById("event-member-attendance-section");
    const attendanceList = document.getElementById("event-member-attendance-list");
    
    if (!attendanceSection || !attendanceList) {
      return;
    }
    
    if (!isAdmin) {
      attendanceSection.style.display = "none";
      return;
    }
    
    attendanceSection.style.display = "";
    
    const isPastEvent = eventData.date && new Date(eventData.date) < new Date();
    const members = (MEMBERS.membersData || []).filter(m => m.active);
    
    if (!members || members.length === 0) {
      attendanceList.innerHTML = '<div class="event-member-attendance-loading">Sense membres disponibles</div>';
      return;
    }
    
    const attendeesList = eventData.attendees || [];
    const rejectionsList = eventData.rejections || [];
    const memberNotes = eventData.notes || {};
    
    const membersHTML = members.map(member => {
      const memberAlias = member.alias;
      
      let statusClass = "empty";
      let isChecked = false;
      
      if (rejectionsList.includes(memberAlias)) {
        statusClass = "rejected";
        isChecked = false;
      } else if (attendeesList.includes(memberAlias)) {
        statusClass = "attending";
        isChecked = true;
      }
      
      const memberNote = memberNotes[memberAlias] || '';
      const noteHtml = memberNote ? `<span class="event-member-note" title="${escapeHtml(memberNote)}">ℹ️ «${escapeHtml(memberNote)}»</span>` : '';
      const isDisabledAttendance = isPastEvent && !isEventEditable;
      const disabledAttr = isDisabledAttendance ? 'disabled' : '';
      const disabledClass = isDisabledAttendance ? ' disabled' : '';
      
      return `
        <div class="event-member-item${memberNote ? ' has-note' : ''}${disabledClass}">
          <label class="event-member-checkbox-label">
            <input type="checkbox" class="event-member-checkbox" data-alias="${memberAlias}" ${isChecked ? 'checked' : ''} ${disabledAttr} />
            <span class="event-member-checkbox-custom ${statusClass}"></span>
            <span class="event-member-name">${memberAlias}</span>
          </label>
          ${noteHtml}
        </div>
      `;
    }).join("");
    
    attendanceList.innerHTML = membersHTML;

    const countSpan = document.getElementById("event-attendance-count");
    if (countSpan) {
      const attendCount = attendeesList.length;
      const rejectCount = rejectionsList.length;
      countSpan.textContent = `${attendCount} SI / ${rejectCount} NO`;
    }
    
    if (!isPastEvent || isEventEditable) {
      attendanceList.querySelectorAll('.event-member-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function(event) { EVENTS.handleMemberEventAttendanceChange(event); });
      });
    }
    
    attendanceList.scrollTop = 0;
  }

  handleMemberEventAttendanceChange(event) {
    const checkbox = event.target;
    const memberAlias = checkbox.dataset.alias;
    const attending = checkbox.checked;
    const eventId = APP.currentEventId;
    
    if (!eventId || !memberAlias) {
      console.error('Missing eventId or memberAlias');
      return;
    }
    
    checkbox.disabled = true;
    const customCheckbox = checkbox.nextElementSibling;
    customCheckbox.classList.add('loading');
    
    API.confirmEventMemberAttendance({ eventId, memberAlias, attending })
      .then(function(response) {
        customCheckbox.classList.remove('loading', 'empty', 'attending', 'rejected');
        customCheckbox.classList.add(attending ? 'attending' : 'empty');
        
        if (APP.currentEventData) {
          const attendeesList = APP.currentEventData.attendees || [];
          const rejectionsList = APP.currentEventData.rejections || [];
          if (attending) {
            if (!attendeesList.includes(memberAlias)) {
              attendeesList.push(memberAlias);
            }
            const rejIdx = rejectionsList.indexOf(memberAlias);
            if (rejIdx > -1) {
              rejectionsList.splice(rejIdx, 1);
            }
          } else {
            const attIdx = attendeesList.indexOf(memberAlias);
            if (attIdx > -1) {
              attendeesList.splice(attIdx, 1);
            }
            if (!rejectionsList.includes(memberAlias)) {
              rejectionsList.push(memberAlias);
            }
          }
          APP.currentEventData.attendees = attendeesList;
          APP.currentEventData.rejections = rejectionsList;

          const countSpan = document.getElementById("event-attendance-count");
          if (countSpan) {
            const attendCount = attendeesList.length;
            const rejectCount = rejectionsList.length;
            countSpan.textContent = `${attendCount} SI / ${rejectCount} NO`;
          }
        }
      })
      .catch(function(error) {
        console.error('Error updating attendance:', error);
        UI.showToast(error || 'Error actualitzant assistència', 'error');
        checkbox.checked = !attending;
      })
      .finally(function() {
        checkbox.disabled = false;
        customCheckbox.classList.remove('loading');
      });
  }

  confirmEventAttendance(eventId) {
    if (!APP.currentUser) {
      UI.showToast('Si us plau, inicia sessió', 'warning');
      return;
    }

    this.updateEventAttendance(eventId, APP.currentUser.alias, true);
  }

  rejectEventAttendance(eventId) {
    if (!APP.currentUser) {
      UI.showToast('Si us plau, inicia sessió', 'warning');
      return;
    }

    this.updateEventAttendance(eventId, APP.currentUser.alias, false);
  }

  confirmEventRelatedMemberAttendance(eventId, memberAlias) {
    this.updateEventAttendance(eventId, memberAlias, true);
  }

  rejectEventRelatedMemberAttendance(eventId, memberAlias) {
    this.updateEventAttendance(eventId, memberAlias, false);
  }

  updateEventAttendance(eventId, memberAlias, attending) {
    const section = document.querySelector(`.event-confirmation-section[data-event-id="${eventId}"][data-member-alias="${memberAlias}"]`);
    if (!section) {
      console.error('Event confirmation section not found');
      return;
    }

    const statusIndicator = section.querySelector('.event-status-indicator');
    const buttonsContainer = section.querySelector('.event-confirmation-buttons');
    
    const originalStatusHtml = statusIndicator ? statusIndicator.outerHTML : '';
    const originalButtonsHtml = buttonsContainer ? buttonsContainer.innerHTML : '';

    if (buttonsContainer) {
      buttonsContainer.innerHTML = '<span class="event-confirmation-spinner"></span>';
    }

    API.confirmEventMemberAttendance({ eventId, memberAlias, attending })
      .then(function(result) {
        if (statusIndicator) {
          statusIndicator.className = 'event-status-indicator';
          if (attending === true) {
            statusIndicator.classList.add('confirmed');
            statusIndicator.textContent = '✔ Confirmat';
          } else if (attending === false) {
            statusIndicator.classList.add('not-attending');
            const isRelatedMember = section.classList.contains('related-member');
            statusIndicator.textContent = isRelatedMember ? '✕ No assistirà' : '✕ No assistiré';
          } else {
            statusIndicator.classList.add('not-confirmed');
            statusIndicator.textContent = '? No confirmat';
          }
        }

        if (buttonsContainer) {
          const isRelatedMember = section.classList.contains('related-member');
          const confirmFn = isRelatedMember ?
            `EVENTS.confirmEventRelatedMemberAttendance('${escapeHtml(eventId)}', '${escapeHtml(memberAlias)}')` :
            `EVENTS.confirmEventAttendance('${escapeHtml(eventId)}')`;
          const rejectFn = isRelatedMember ?
            `EVENTS.rejectEventRelatedMemberAttendance('${escapeHtml(eventId)}', '${escapeHtml(memberAlias)}')` :
            `EVENTS.rejectEventAttendance('${escapeHtml(eventId)}')`;
          const resetFn = `EVENTS.updateEventAttendance('${escapeHtml(eventId)}', '${escapeHtml(memberAlias)}', null)`;
          
          const noAttendingText = isRelatedMember ? 'No assistirà' : 'No assistiré';
          const noAttendingTitle = isRelatedMember ? 'No assistirà' : 'No assistiré';
          
          let button1Html = '';
          let button2Html = '';
          
          if (attending === true) {
            button1Html = ``;
            button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="${rejectFn}" title="${noAttendingTitle}">✕︎ ${noAttendingText}</button>`;
          } else if (attending === false) {
            button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="${confirmFn}" title="Confirmar assistència">✔︎ Confirmar</button>`;
            button2Html = ``;
          } else {
            button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="${confirmFn}" title="Confirmar assistència">✔︎ Confirmar</button>`;
            button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="${rejectFn}" title="${noAttendingTitle}">✕︎ ${noAttendingText}</button>`;
          }
          
          buttonsContainer.innerHTML = button1Html + button2Html;
        }
        
        UI.showToast('Confirmació actualitzada', 'success');

        const events = CACHE.getEvents() || [];
        const eventIndex = events.findIndex(e => e.id === eventId);
        if (eventIndex !== -1) {
          const event = events[eventIndex];
          if (!event.attendees) event.attendees = [];
          if (!event.rejections) event.rejections = [];

          event.attendees = event.attendees.filter(a => a !== memberAlias);
          event.rejections = event.rejections.filter(r => r !== memberAlias);

          if (attending === true) {
            event.attendees.push(memberAlias);
          } else if (attending === false) {
            event.rejections.push(memberAlias);
          }
          
          CACHE.saveEvents({ events });
          APP.bumpLocalVersion('events');

          if (APP.currentEventData && APP.currentEventData.id === eventId) {
            APP.currentEventData.attendees = event.attendees;
            APP.currentEventData.rejections = event.rejections;
          }
        }
      })
      .catch(function(error) {
        console.error('Error updating event attendance:', error);
        UI.showToast(error || 'Error actualitzant confirmació', 'error');
        if (statusIndicator && originalStatusHtml) {
          statusIndicator.outerHTML = originalStatusHtml;
        }
        if (buttonsContainer && originalButtonsHtml) {
          buttonsContainer.innerHTML = originalButtonsHtml;
        }
      });
  }

  openCheckAttendanceDialog() {
    const dialog = document.getElementById('check-attendance-dialog');
    if (dialog) {
      const prefillId = APP.currentEventData ? (APP.currentEventData.attendanceListId || '') : '';
      document.getElementById('check-attendance-sheet-input').value = prefillId;
      document.getElementById('check-attendance-results').style.display = 'none';
      document.getElementById('check-attendance-results').innerHTML = '';
      dialog.showModal();
      if (prefillId) {
        this.checkFormAttendance();
      }
    }
  }

  closeCheckAttendanceDialog() {
    const dialog = document.getElementById('check-attendance-dialog');
    if (dialog) dialog.close();
  }

  checkFormAttendance() {
    const input = document.getElementById('check-attendance-sheet-input');
    const submitBtn = document.getElementById('check-attendance-submit-btn');
    const resultsContainer = document.getElementById('check-attendance-results');
    const spreadsheetId = (input.value || '').trim();

    if (!spreadsheetId) {
      UI.showToast('Cal indicar l\'identificador de la fulla de respostes', 'error');
      return;
    }

    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';
    submitBtn.disabled = true;

    const eventId = APP.currentEventId || (APP.currentEventData ? APP.currentEventData.name : null);

    API.checkFormAttendance({ spreadsheetId, eventId })
      .then(function(matches) {
        resultsContainer.style.display = 'block';
        if (!matches || matches.length === 0) {
          resultsContainer.innerHTML = '<p class="check-attendance-empty">No s\'han trobat respostes amb "Ball de bastons".</p>';
          return;
        }

        let html = '<h3>Resultats (' + matches.length + ')</h3><ul class="check-attendance-list">';
        matches.forEach(function(match) {
          let icon = match.matched ? '✓' : '?';
          let cls = match.matched ? 'matched' : 'unmatched';
          if (match.attendanceMismatch) {
            icon = '⚠';
            cls = 'mismatch';
          }
          const memberInfo = match.matched ? ' → ' + escapeHtml(match.memberAlias || match.memberName) : ' (sense coincidència)';
          const relatedInfo = match.relatedTo ? '<span class="check-attendance-related">(via ' + escapeHtml(match.relatedTo) + ')</span>' : '';
          let mismatchInfo = '';
          if (match.attendanceMismatch === 'form_yes_app_no') {
            mismatchInfo = '<span class="check-attendance-mismatch">Formulari: Sí · App: No confirmat</span>';
          } else if (match.attendanceMismatch === 'form_no_app_yes') {
            mismatchInfo = '<span class="check-attendance-mismatch">Formulari: No · App: Confirmat</span>';
          }
          html += '<li class="check-attendance-item ' + cls + '"><span class="check-attendance-icon">' + icon + '</span><span class="check-attendance-name">' + escapeHtml(match.formName) + '</span>' + relatedInfo + '<span class="check-attendance-member">' + memberInfo + '</span>' + mismatchInfo + '</li>';
        });
        html += '</ul>';
        resultsContainer.innerHTML = html;
      })
      .catch(function(error) {
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = '<p class="check-attendance-error">' + escapeHtml(error) + '</p>';
      })
      .finally(function() {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        submitBtn.disabled = false;
      });
  }
})();
        var diagrams = [];
        var diagramIdCounter = 0;
        var diagramsIsDirty = false;
        var isEventEditable = true;
        var isEventManuallyUnlocked = false;
        var isTrainingEditable = true;
        var isTrainingManuallyUnlocked = false;

        

        function checkIfEventIsEditable() {
            if (isEventManuallyUnlocked) {
                return true;
            }

            const userRoles = (APP && APP.currentUser && APP.currentUser.roles) || [];
            const isAdmin = userRoles.includes('ADMIN');
            if (!isAdmin) {
                isEventEditable = false;
                return false;
            }

            if (!APP.currentEventId) {
                isEventEditable = true;
                return true;
            }

            const eventDatetimeInput = document.getElementById('event-datetime-input');
            if (!eventDatetimeInput || !eventDatetimeInput.value) {
                return true;
            }
            const eventDate = new Date(eventDatetimeInput.value);
            const now = new Date();
            isEventEditable = eventDate >= now;
            return isEventEditable;
        }

        function applyEditableState() {
            const isEditable = checkIfEventIsEditable();
            const eventNameInput = document.getElementById('event-name-input');
            const eventDatetimeInput = document.getElementById('event-datetime-input');
            const eventMeetingPlaceInput = document.getElementById('event-meeting-place-input');
            const eventNameLabel = document.getElementById('event-name-label');
            const eventDatetimeLabel = document.getElementById('event-datetime-label');
            const eventMeetingPlaceLabel = document.getElementById('event-meeting-place-label');
            const danceSelectorSection = document.getElementById('dance-selector-section');
            const floatingSaveBtn = document.getElementById('floating-save-btn');
            const floatingLockBtn = document.getElementById('floating-lock-btn');
            const checkAttendanceRow = document.querySelector('.event-check-attendance-row');

            if (isEditable) {
                if (eventNameInput) {
                    eventNameInput.disabled = false;
                    eventNameInput.style.display = 'block';
                }
                if (eventDatetimeInput) {
                    eventDatetimeInput.disabled = false;
                    eventDatetimeInput.style.display = 'block';
                }
                if (eventMeetingPlaceInput) {
                    eventMeetingPlaceInput.disabled = false;
                    eventMeetingPlaceInput.style.display = 'block';
                }
                if (eventNameLabel) eventNameLabel.style.display = 'none';
                if (eventDatetimeLabel) eventDatetimeLabel.style.display = 'none';
                if (eventMeetingPlaceLabel) eventMeetingPlaceLabel.style.display = 'none';
            } else {
                if (eventNameInput && eventNameLabel) {
                    eventNameLabel.textContent = eventNameInput.value || '';
                    eventNameInput.style.display = 'none';
                    eventNameLabel.style.display = 'block';
                }
                if (eventDatetimeInput && eventDatetimeLabel) {
                    const datetimeValue = eventDatetimeInput.value;
                    let formattedDatetime = datetimeValue;
                    if (datetimeValue) {
                        const date = new Date(datetimeValue + ':00');
                        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                        formattedDatetime = date.toLocaleDateString('ca-ES', options);
                    }
                    eventDatetimeLabel.textContent = formattedDatetime;
                    eventDatetimeInput.style.display = 'none';
                    eventDatetimeLabel.style.display = 'block';
                }
                if (eventMeetingPlaceInput && eventMeetingPlaceLabel) {
                    eventMeetingPlaceLabel.textContent = eventMeetingPlaceInput.value || '';
                    eventMeetingPlaceInput.style.display = 'none';
                    eventMeetingPlaceLabel.style.display = 'block';
                }
            }

            if (danceSelectorSection) {
                if (!isEditable) {
                    danceSelectorSection.style.display = 'none';
                }
                danceSelectorSection.style.pointerEvents = isEditable ? 'auto' : 'none';
            }

            if (checkAttendanceRow) {
                checkAttendanceRow.style.display = isEditable ? '' : 'none';
            }

            if (floatingSaveBtn) {
                floatingSaveBtn.style.display = isEditable ? 'flex' : 'none';
            }

            if (floatingLockBtn) {
                const isAdmin = APP.currentUser && APP.currentUser.roles && APP.currentUser.roles.includes('ADMIN');
                floatingLockBtn.style.display = (!isEditable && isAdmin) ? 'flex' : 'none';
            }

            updateDiagramsEditableState(isEditable);
        }

        function updateDiagramsEditableState(isEditable) {
            const diagramsList = document.getElementById('diagrams-list');
            if (!diagramsList) return;

            const diagramItems = diagramsList.querySelectorAll('.diagram-item');
            diagramItems.forEach(function (item) {
                item.style.pointerEvents = isEditable ? 'auto' : 'none';
                item.draggable = isEditable;
                item.style.cursor = isEditable ? 'grab' : 'default';
            });

            const actionButtons = diagramsList.querySelectorAll('.add-group-btn, .remove-diagram-btn, .edit-description-btn, .add-description-link, .main-btn, .reserva-btn, .remove-backup-btn');
            actionButtons.forEach(function (btn) {
                btn.disabled = !isEditable;
                btn.style.cursor = isEditable ? 'pointer' : 'not-allowed';
                btn.style.pointerEvents = isEditable ? 'auto' : 'none';
            });

            const lockedHiddenElements = diagramsList.querySelectorAll('.diagram-header-actions, .reserva-btn, .remove-backup-btn');
            lockedHiddenElements.forEach(function (el) {
                el.style.display = isEditable ? '' : 'none';
            });

            const editDescriptionBtns = diagramsList.querySelectorAll('.edit-description-btn');
            editDescriptionBtns.forEach(function (btn) {
                btn.style.display = isEditable ? 'block' : 'none';
            });

            const addDescriptionLinks = diagramsList.querySelectorAll('.add-description-link');
            addDescriptionLinks.forEach(function (link) {
                link.style.display = isEditable ? 'block' : 'none';
            });

            const magicBtns = diagramsList.querySelectorAll('.magic-generated-btn');
            magicBtns.forEach(function (btn) {
                btn.style.display = isEditable ? '' : 'none';
            });

            const currentUserRoles = (APP && APP.currentUser && APP.currentUser.roles) || [];
            const isAdmin = currentUserRoles.includes('ADMIN');
            const canvases = diagramsList.querySelectorAll('canvas');
            canvases.forEach(function (canvas) {
                canvas.style.cursor = (isEditable && isAdmin) ? 'pointer' : 'default';
                canvas.style.pointerEvents = (isEditable && isAdmin) ? 'auto' : 'none';
            });
        }

        function updateSaveButtonState() {
            const btn = document.getElementById('floating-save-btn');
            if (btn) {
                btn.disabled = !diagramsIsDirty || !isEventEditable;
            }
        }

        function setDiagramsDirty(isDirty) {
            diagramsIsDirty = isDirty;
            updateSaveButtonState();
            updateMemberPositionOverlay();
        }

        function updateMemberPositionOverlay() {
            const overlay = document.getElementById('member-position-overlay');
            const list = document.getElementById('member-position-overlay-list');
            if (!overlay || !list) return;

            const counts = {};
            diagrams.forEach(function (diagram) {
                const groups = diagram.groups || [];
                groups.forEach(function (group) {
                    group.forEach(function (name) {
                        if (name) {
                            counts[name] = (counts[name] || 0) + 1;
                        }
                    });
                });
            });

            const entries = Object.entries(counts).sort(function (a, b) {
                return b[1] - a[1] || a[0].localeCompare(b[0]);
            });

            if (entries.length === 0) {
                overlay.style.display = 'none';
                return;
            }

            overlay.style.display = '';
            list.innerHTML = entries.map(function (entry) {
                return '<li><span class="member-name">' + entry[0] + '</span><span class="position-count">' + entry[1] + '</span></li>';
            }).join('');
        }

        function calcDiagramLayout(canvas, groupCount, rows, cols) {
            const baseSquareWidth = 180;
            const baseSquareHeight = 90;
            const baseSquareSpacingX = 24;
            const baseSquareSpacingY = 24;
            const baseSpacing = 120;
            const baseOffsetY = 40;
            const minPadding = 40;

            // Calculate what the total width would be at base size
            const baseGridWidth = baseSquareWidth * cols + baseSquareSpacingX * (cols - 1);
            const baseTotalWidth = groupCount * baseGridWidth + (groupCount - 1) * baseSpacing;
            const availableWidth = canvas.width - (minPadding * 2);

            let scale = 1;
            if (baseTotalWidth > availableWidth) {
                scale = availableWidth / baseTotalWidth;
            }

            const squareWidth = baseSquareWidth * scale;
            const squareHeight = baseSquareHeight * scale;
            const squareSpacingX = baseSquareSpacingX * scale;
            const squareSpacingY = baseSquareSpacingY * scale;
            const spacing = baseSpacing * scale;
            const offsetY = baseOffsetY;

            const gridWidth = squareWidth * cols + squareSpacingX * (cols - 1);
            const gridHeight = squareHeight * rows + squareSpacingY * (rows - 1);
            const totalWidth = groupCount * gridWidth + (groupCount - 1) * spacing;
            const offsetX0 = (canvas.width - totalWidth) / 2;

            const placaHeight = Math.max(25, 40 * scale);
            const placaY = offsetY + gridHeight + 60 * scale;
            const requiredHeight = placaY + placaHeight + 15;

            return {
                squareWidth,
                squareHeight,
                squareSpacingX,
                squareSpacingY,
                spacing,
                gridWidth,
                gridHeight,
                totalWidth,
                offsetX0,
                offsetY,
                scale,
                requiredHeight
            };
        }

        function calcRadialDiagramLayout(canvas, groupCount, rows, cols) {
            const baseCellWidth = 100;
            const baseCellHeight = 50;
            const baseCoupleGap = 8;
            const baseCellArcGap = 100;
            const baseLabelSpace = 40;
            const baseCoupleHeight = baseCellHeight * rows + baseCoupleGap * (rows - 1);
            const minCircumference = groupCount * (baseCellWidth + baseCellArcGap);
            const baseRadius = Math.max(minCircumference / (2 * Math.PI), 120);
            const maxHorizontalExtent = baseCellWidth / 2;
            const maxVerticalExtent = baseCoupleHeight / 2;
            const totalDiameter = 2 * (baseRadius + maxHorizontalExtent + baseLabelSpace + 20);
            const availableWidth = canvas.width - 40;
            const scale = Math.min(1, availableWidth / totalDiameter);
            const cellWidth = baseCellWidth * scale;
            const cellHeight = baseCellHeight * scale;
            const coupleGap = baseCoupleGap * scale;
            const coupleHeight = cellHeight * rows + coupleGap * (rows - 1);
            const labelSpace = baseLabelSpace * scale;
            const radius = baseRadius * scale;
            const centerX = canvas.width / 2;
            const centerY = radius + maxVerticalExtent * scale + labelSpace + 30;
            const circleBottom = centerY + radius + maxVerticalExtent * scale + labelSpace;
            const placaHeight = Math.max(25, 40 * scale);
            const placaY = circleBottom + 60 * scale;
            const placaWidth = 2 * radius;
            const placaX = centerX - placaWidth / 2;
            const requiredHeight = placaY + placaHeight + 15;
            return {
                cellWidth, cellHeight, coupleGap, coupleHeight, labelSpace,
                radius, centerX, centerY,
                placaX, placaY, placaWidth, placaHeight,
                scale, requiredHeight
            };
        }

        function drawRadialDiagram(ctx, canvas, groups, rows, cols, positions, diagramColors, groupCount) {
            const rl = calcRadialDiagramLayout(canvas, groupCount, rows, cols);
            if (canvas.height !== Math.round(rl.requiredHeight)) {
                canvas.height = Math.round(rl.requiredHeight);
            }

            function getCellBgColor(row, col) {
                const order = row * cols + col + 1;
                const pos = positions.find(function (p) { return p.order === order; });
                if (pos && pos.positionType.label && diagramColors.backgroundColor && diagramColors.backgroundColor[pos.positionType.label]) {
                    return diagramColors.backgroundColor[pos.positionType.label];
                }
                return '#808080';
            }

            function getCellTxtColor(row, col) {
                const order = row * cols + col + 1;
                const pos = positions.find(function (p) { return p.order === order; });
                if (pos && pos.positionType.label && diagramColors.textColor && diagramColors.textColor[pos.positionType.label]) {
                    return diagramColors.textColor[pos.positionType.label];
                }
                return '#FFFFFF';
            }

            const currentUserAlias = (APP && APP.currentUser && APP.currentUser.alias) || null;
            const currentUserRoles = (APP && APP.currentUser && APP.currentUser.roles) || [];
            const isCurrentUserAdmin = currentUserRoles.includes('ADMIN');
            const relatedMembers = (APP && APP.currentUser && APP.currentUser.relatedMembers) || [];
            const relatedAliases = relatedMembers.map(function(rm) { return rm.alias; }).filter(Boolean);
            const allAliases = currentUserAlias ? [currentUserAlias].concat(relatedAliases) : relatedAliases;

            for (let g = 0; g < groupCount; g++) {
                const group = groups[g];
                const angle = -Math.PI / 2 + (2 * Math.PI * g) / groupCount;
                const groupCenterX = rl.centerX + rl.radius * Math.cos(angle);
                const groupCenterY = rl.centerY + rl.radius * Math.sin(angle);

                if (groupCount > 1) {
                    ctx.save();
                    const cosA = Math.abs(Math.cos(angle));
                    const sinA = Math.abs(Math.sin(angle));
                    const coupleExtent = rl.cellWidth / 2 * cosA + rl.coupleHeight / 2 * sinA;
                    const labelRadius = rl.radius + coupleExtent + rl.labelSpace;
                    const labelX = rl.centerX + labelRadius * Math.cos(angle);
                    const labelY = rl.centerY + labelRadius * Math.sin(angle);
                    const groupLabelFontSize = Math.max(10, Math.round(16 * rl.scale));
                    ctx.font = 'bold ' + groupLabelFontSize + 'px sans-serif';
                    ctx.fillStyle = '#555';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const groupLetter = String.fromCharCode(65 + g);
                    const blockName = diagramColors.blockName || '';
                    const groupLabel = blockName ? blockName + ' ' + groupLetter : groupLetter;
                    ctx.fillText(groupLabel, labelX, labelY);
                    ctx.restore();
                }

                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const i = row * cols + col;
                        const cellCenterX = groupCenterX;
                        const cellCenterY = groupCenterY - rl.coupleHeight / 2 + row * (rl.cellHeight + rl.coupleGap) + rl.cellHeight / 2;
                        const x = cellCenterX - rl.cellWidth / 2;
                        const y = cellCenterY - rl.cellHeight / 2;

                        // Check if member is not attending or not yet confirmed
                        const rejections = (APP.currentEventData && APP.currentEventData.rejections) || [];
                        const attendees = (APP.currentEventData && APP.currentEventData.attendees) || [];
                        const isRejected = group[i] && rejections.includes(group[i]);
                        const isNotConfirmed = group[i] && !isRejected && !attendees.includes(group[i]);

                        ctx.fillStyle = isRejected ? '#dc3545' : (isNotConfirmed ? '#f0ad4e' : getCellBgColor(row, col));
                        ctx.fillRect(x, y, rl.cellWidth, rl.cellHeight);
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = Math.max(2, 4 * rl.scale);
                        ctx.strokeRect(x, y, rl.cellWidth, rl.cellHeight);

                        if (!isCurrentUserAdmin && group[i] && allAliases.includes(group[i])) {
                            const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
                            ctx.strokeStyle = primaryColor || '#6366f1';
                            ctx.lineWidth = Math.max(4, 8 * rl.scale);
                            ctx.strokeRect(x, y, rl.cellWidth, rl.cellHeight);
                        }

                        if (group[i]) {
                            ctx.fillStyle = (isRejected || isNotConfirmed) ? '#ffffff' : getCellTxtColor(row, col);
                            const nameFontSize = Math.max(10, Math.round(18 * rl.scale));
                            ctx.font = 'bold ' + nameFontSize + 'px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            const displayName = isRejected ? '⚠️ ' + group[i] : (isNotConfirmed ? '❓ ' + group[i] : group[i]);
                            ctx.fillText(displayName, cellCenterX, cellCenterY);
                        }
                    }
                }
            }

            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = Math.max(1, 2 * rl.scale);
            ctx.fillRect(rl.placaX, rl.placaY, rl.placaWidth, rl.placaHeight);
            ctx.strokeRect(rl.placaX, rl.placaY, rl.placaWidth, rl.placaHeight);
            const placaFontSize = Math.max(12, Math.round(20 * rl.scale));
            ctx.fillStyle = '#000';
            ctx.font = 'bold ' + placaFontSize + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PLAÇA', rl.placaX + rl.placaWidth / 2, rl.placaY + rl.placaHeight / 2);
            ctx.restore();
        }

        var selectedCellHighlight = null;

        // Draw a specific diagram
        function drawDiagram(diagram) {
            const canvas = document.getElementById('diagram-canvas-' + diagram.id);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const groups = diagram.groups;
            const rows = diagram.rows || 2;
            const cols = diagram.columns || 2;
            const positions = diagram.positions || [];
            const diagramColors = diagram.diagram || { backgroundColor: {}, textColor: {} };
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const groupCount = groups.length;
            const forms = diagram.forms || ['grid'];
            const activeForm = diagram.activeForm || forms[0];
            if (activeForm === 'radial') {
                drawRadialDiagram(ctx, canvas, groups, rows, cols, positions, diagramColors, groupCount);
                return;
            }

            // Layout: stack groups horizontally, centered vertically
            // Calculate scaled layout based on group count
            const layout = calcDiagramLayout(canvas, groupCount, rows, cols);
            const { squareWidth, squareHeight, squareSpacingX, squareSpacingY, spacing, gridWidth, gridHeight, totalWidth, offsetX0, offsetY, scale, requiredHeight } = layout;

            // Resize canvas height if needed
            if (canvas.height !== Math.round(requiredHeight)) {
                canvas.height = Math.round(requiredHeight);
            }

            // Get background color for a cell from diagram.backgroundColor using position label
            // Grid layout: top-left is order 1, going left-to-right, top-to-bottom
            // Formula: order = row * cols + col + 1
            function getCellBackgroundColor(row, col) {
                const order = row * cols + col + 1;
                const pos = positions.find(function (p) { return p.order === order; });
                if (pos && pos.positionType.label && diagramColors.backgroundColor && diagramColors.backgroundColor[pos.positionType.label]) {
                    return diagramColors.backgroundColor[pos.positionType.label];
                }
                return '#808080';
            }

            // Get text color for a cell from diagram.textColor using position label
            function getCellTextColor(row, col) {
                const order = row * cols + col + 1;
                const pos = positions.find(function (p) { return p.order === order; });
                if (pos && pos.positionType.label && diagramColors.textColor && diagramColors.textColor[pos.positionType.label]) {
                    return diagramColors.textColor[pos.positionType.label];
                }
                return '#FFFFFF';
            }

            for (let g = 0; g < groupCount; g++) {
                const group = groups[g];
                const offsetX = offsetX0 + g * (gridWidth + spacing);
                if (groupCount > 1) {
                    ctx.save();
                    const groupLabelFontSize = Math.max(12, Math.round(22 * scale));
                    ctx.font = 'bold ' + groupLabelFontSize + 'px sans-serif';
                    ctx.fillStyle = '#555';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    const groupLetter = String.fromCharCode(65 + g);
                    const blockName = diagramColors.blockName || '';
                    const groupLabel = blockName ? blockName + ' ' + groupLetter : groupLetter;
                    ctx.fillText(groupLabel, offsetX + gridWidth / 2, offsetY - 10 * scale);
                    ctx.restore();
                }
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const i = row * cols + col;
                        const x = offsetX + col * (squareWidth + squareSpacingX);
                        const y = offsetY + row * (squareHeight + squareSpacingY);
                        
                        // Check if member is not attending or not yet confirmed
                        const rejections = (APP.currentEventData && APP.currentEventData.rejections) || [];
                        const attendees = (APP.currentEventData && APP.currentEventData.attendees) || [];
                        const isRejected = group[i] && rejections.includes(group[i]);
                        const isNotConfirmed = group[i] && !isRejected && !attendees.includes(group[i]);
                        
                        ctx.fillStyle = isRejected ? '#dc3545' : (isNotConfirmed ? '#f0ad4e' : getCellBackgroundColor(row, col));
                        ctx.fillRect(x, y, squareWidth, squareHeight);
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = Math.max(2, 4 * scale);
                        ctx.strokeRect(x, y, squareWidth, squareHeight);

                        // Draw border around current member's position and related members (non-admin only)
                        const currentUserAlias = (APP && APP.currentUser && APP.currentUser.alias) || null;
                        const currentUserRoles = (APP && APP.currentUser && APP.currentUser.roles) || [];
                        const isCurrentUserAdmin = currentUserRoles.includes('ADMIN');
                        const relatedMembers = (APP && APP.currentUser && APP.currentUser.relatedMembers) || [];
                        const relatedAliases = relatedMembers.map(function(rm) { return rm.alias; }).filter(Boolean);
                        const allAliases = currentUserAlias ? [currentUserAlias].concat(relatedAliases) : relatedAliases;
                        if (!isCurrentUserAdmin && group[i] && allAliases.includes(group[i])) {
                            const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
                            ctx.strokeStyle = primaryColor || '#6366f1';
                            ctx.lineWidth = Math.max(4, 8 * scale);
                            ctx.strokeRect(x, y, squareWidth, squareHeight);
                        }

                        if (selectedCellHighlight && selectedCellHighlight.diagramId === diagram.id && selectedCellHighlight.groupIdx === g && selectedCellHighlight.cellIdx === i) {
                            var hlColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
                            ctx.strokeStyle = hlColor || '#6366f1';
                            ctx.lineWidth = Math.max(4, 8 * scale);
                            ctx.strokeRect(x, y, squareWidth, squareHeight);
                        }

                        if (group[i]) {
                            ctx.fillStyle = (isRejected || isNotConfirmed) ? '#ffffff' : getCellTextColor(row, col);
                            const nameFontSize = Math.max(10, Math.round(20 * scale));
                            ctx.font = 'bold ' + nameFontSize + 'px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            const displayName = isRejected ? '⚠️ ' + group[i] : (isNotConfirmed ? '❓ ' + group[i] : group[i]);
                            ctx.fillText(displayName, x + squareWidth / 2, y + squareHeight / 2);
                        }
                    }
                }
            }
            // Draw single PLAÇA spanning all groups
            const placaHeight = Math.max(25, 40 * scale);
            const placaY = offsetY + gridHeight + 60 * scale;
            const placaFontSize = Math.max(12, Math.round(20 * scale));
            const placaX = offsetX0;
            const placaWidth = totalWidth;

            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = Math.max(1, 2 * scale);
            ctx.fillRect(placaX, placaY, placaWidth, placaHeight);
            ctx.strokeRect(placaX, placaY, placaWidth, placaHeight);
            ctx.fillStyle = '#000';
            ctx.font = 'bold ' + placaFontSize + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PLAÇA', placaX + placaWidth / 2, placaY + placaHeight / 2);
            ctx.restore();
        }

        function drawAllDiagrams() {
            diagrams.forEach(function (diagram) {
                drawDiagram(diagram);
            });
        }

        function createDiagramElement(diagram) {
            const div = document.createElement('div');
            div.className = 'diagram-item';
            div.id = 'diagram-item-' + diagram.id;
            div.draggable = true;
            div.dataset.diagramId = diagram.id;

            // Generate legend items from positions (unique labels only)
            const rows = diagram.rows || 2;
            const cols = diagram.columns || 2;
            const positions = diagram.positions || [];
            const diagramColors = diagram.diagram || { backgroundColor: {}, textColor: {} };
            const blockName = diagramColors.blockName || 'grup';
            let legendHtml = '';
            const seenLabels = new Set();
            positions.forEach(function (pos) {
                if (seenLabels.has(pos.positionType.label)) return;
                seenLabels.add(pos.positionType.label);
                const color = (diagramColors.backgroundColor && diagramColors.backgroundColor[pos.positionType.label]) || '#808080';
                legendHtml += `
<div class="diagram-legend-item">
    <span class="legend-color-box" style="background: ${color};"></span>
    <span>${pos.positionType.label}</span>
</div>`;
            });

            // Hide legend if only one item
            const showLegend = seenLabels.size > 1;
            const legendStyle = showLegend ? '' : 'display: none;';

            // Check if user is admin
            const userRoles = (APP && APP.currentUser && APP.currentUser.roles) || [];
            const isAdmin = userRoles.includes('ADMIN');
            const adminOnlyStyle = isAdmin ? '' : 'display: none;';

            const forms = diagram.forms || ['grid'];
            let formsHtml = '';
            if (forms.length >= 2) {
                const activeForm = diagram.activeForm || forms[0];
                formsHtml = '<div class="diagram-form-toggle">';
                forms.forEach(function (form) {
                    const activeClass = form === activeForm ? ' active' : '';
                    const label = form === 'radial' ? '◯' : '▦';
                    formsHtml += '<button type="button" class="form-toggle-btn' + activeClass + '" data-diagram-id="' + diagram.id + '" data-form="' + form + '" title="' + form + '">' + label + '</button>';
                });
                formsHtml += '</div>';
            }

            const description = diagram.description || '';
            const hasDescription = description.trim().length > 0;

            // Description HTML based on admin status
            let descriptionHtml = '';
            if (isAdmin) {
                if (hasDescription) {
                    descriptionHtml = `
    <div class="diagram-description-container">
    <span class="diagram-description-text" id="desc-text-${diagram.id}">${description}</span>
    <button type="button" class="edit-description-btn" data-id="${diagram.id}" title="Editar descripció">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
    </button>
    <input type="text" class="diagram-description-input" id="desc-input-${diagram.id}" value="${description}" style="display: none;" placeholder="Descripció...">
    <button type="button" class="magic-generated-btn" data-id="${diagram.id}" title="Generar màgicament">
        <svg width="24" height="24" viewBox="0 0 48 48" fill="none"><path fill="#32bea6" d="M24 47.998c13.255 0 24-10.745 24-24C48 10.746 37.255 0 24 0S0 10.745 0 23.999s10.745 23.999 24 23.999"/><path fill="#3e3e3f" d="m10.91 34.26l3.702 3.702l15.427-15.427l-3.702-3.702z"/><path fill="#e2e4e5" d="m26.337 18.833l3.703 3.702l5.554-5.554l-3.703-3.702z"/><path fill="#fff" d="m26.337 18.832l1.851 1.851l5.554-5.554l-1.851-1.85z"/><path fill="#5b5c5f" d="m28.188 20.684l-1.851-1.852L10.909 34.26l1.851 1.851z"/><path fill="#fbe158" d="M18.345 14.55a.02.02 0 0 0-.018.02v.04q0 .011.012.014c1.371.187 2.38 1.194 2.569 2.564a.02.02 0 0 0 .02.017h.04a.014.014 0 0 0 .014-.011c.186-1.372 1.193-2.38 2.564-2.57a.02.02 0 0 0 .017-.02v-.04a.014.014 0 0 0-.012-.013c-1.371-.187-2.38-1.194-2.569-2.564a.02.02 0 0 0-.02-.018h-.028a.03.03 0 0 0-.028.024c-.19 1.365-1.195 2.369-2.561 2.557m13.964 10.91a.02.02 0 0 0-.018.02v.045q0 .006.006.007c1.375.184 2.386 1.192 2.575 2.565a.02.02 0 0 0 .02.017h.029c.013 0 .025-.01.027-.023c.19-1.36 1.187-2.36 2.545-2.555a.04.04 0 0 0 .034-.04v-.022a.014.014 0 0 0-.011-.014c-1.372-.186-2.38-1.194-2.57-2.564a.02.02 0 0 0-.02-.017h-.028a.03.03 0 0 0-.027.023c-.19 1.365-1.196 2.369-2.562 2.557m2.611-13.293a.01.01 0 0 0-.01.012v.017q0 .012.013.015c.8.112 1.386.703 1.493 1.505h.04c.107-.807.7-1.4 1.507-1.506v-.04c-.807-.108-1.4-.7-1.507-1.508h-.04a1.714 1.714 0 0 1-1.496 1.505"/></svg>
    </button>
    </div>`;
                } else {
                    descriptionHtml = `
    <div class="diagram-description-container">
    <a href="#" class="add-description-link" data-id="${diagram.id}">+ Afegir descripció</a>
    <input type="text" class="diagram-description-input" id="desc-input-${diagram.id}" value="" style="display: none;" placeholder="Descripció...">
    <button type="button" class="magic-generated-btn" data-id="${diagram.id}" title="Generar màgicament">
        <svg width="24" height="24" viewBox="0 0 48 48" fill="none"><path fill="#32bea6" d="M24 47.998c13.255 0 24-10.745 24-24C48 10.746 37.255 0 24 0S0 10.745 0 23.999s10.745 23.999 24 23.999"/><path fill="#3e3e3f" d="m10.91 34.26l3.702 3.702l15.427-15.427l-3.702-3.702z"/><path fill="#e2e4e5" d="m26.337 18.833l3.703 3.702l5.554-5.554l-3.703-3.702z"/><path fill="#fff" d="m26.337 18.832l1.851 1.851l5.554-5.554l-1.851-1.85z"/><path fill="#5b5c5f" d="m28.188 20.684l-1.851-1.852L10.909 34.26l1.851 1.851z"/><path fill="#fbe158" d="M18.345 14.55a.02.02 0 0 0-.018.02v.04q0 .011.012.014c1.371.187 2.38 1.194 2.569 2.564a.02.02 0 0 0 .02.017h.04a.014.014 0 0 0 .014-.011c.186-1.372 1.193-2.38 2.564-2.57a.02.02 0 0 0 .017-.02v-.04a.014.014 0 0 0-.012-.013c-1.371-.187-2.38-1.194-2.569-2.564a.02.02 0 0 0-.02-.018h-.028a.03.03 0 0 0-.028.024c-.19 1.365-1.195 2.369-2.561 2.557m13.964 10.91a.02.02 0 0 0-.018.02v.045q0 .006.006.007c1.375.184 2.386 1.192 2.575 2.565a.02.02 0 0 0 .02.017h.029c.013 0 .025-.01.027-.023c.19-1.36 1.187-2.36 2.545-2.555a.04.04 0 0 0 .034-.04v-.022a.014.014 0 0 0-.011-.014c-1.372-.186-2.38-1.194-2.57-2.564a.02.02 0 0 0-.02-.017h-.028a.03.03 0 0 0-.027.023c-.19 1.365-1.196 2.369-2.562 2.557m2.611-13.293a.01.01 0 0 0-.01.012v.017q0 .012.013.015c.8.112 1.386.703 1.493 1.505h.04c.107-.807.7-1.4 1.507-1.506v-.04c-.807-.108-1.4-.7-1.507-1.508h-.04a1.714 1.714 0 0 1-1.496 1.505"/></svg>
    </button>
    </div>`;
                }
            } else {
                if (hasDescription) {
                    descriptionHtml = `<div class="diagram-description-container"><span class="diagram-description-text">${description}</span></div>`;
                }
            }

            // Generate backup members display
            const backup = diagram.backup || [];
            let backupHtml = '';
            if (backup.length > 0) {
                const rejections = (APP.currentEventData && APP.currentEventData.rejections) || [];
                const attendees = (APP.currentEventData && APP.currentEventData.attendees) || [];
                backupHtml = '<div class="backup-members-list">';
                backup.forEach(function (memberAlias) {
                    const isRejected = rejections.includes(memberAlias);
                    const isNotConfirmed = !isRejected && !attendees.includes(memberAlias);
                    const chipStyle = isRejected ? 'background-color: #dc3545; border-color: #dc3545; color: white;' : (isNotConfirmed ? 'background-color: #f0ad4e; border-color: #f0ad4e; color: white;' : '');
                    const warningIcon = isRejected ? '⚠️ ' : (isNotConfirmed ? '❓ ' : '');
                    backupHtml += `<span class="backup-member-chip" style="${chipStyle}">${warningIcon}${memberAlias}`;
                    if (isAdmin) {
                        backupHtml += `<button type="button" class="remove-backup-btn" data-diagram-id="${diagram.id}" data-member="${memberAlias}" title="Eliminar">×</button>`;
                    }
                    backupHtml += '</span>';
                });
                backupHtml += '</div>';
            }

            div.innerHTML = `
<div class="diagram-header">
${descriptionHtml}
<div class="diagram-title-row">
    <h3 class="diagram-title">${diagram.danceName}</h3>
</div>
<div class="diagram-legend" style="${legendStyle}">
    ${legendHtml}
</div>
<div class="diagram-header-actions" style="${adminOnlyStyle}">
    <button class="main-btn add-group-btn" style="${adminOnlyStyle}" data-id="${diagram.id}">+ Afegir ${blockName}</button>
    <button class="remove-diagram-btn" style="${adminOnlyStyle}" data-id="${diagram.id}">Eliminar ball</button>
</div>
</div>
<div class="diagrams-canvas-container">
<div class="diagrams-canvas-wrapper">
    ${formsHtml}
    <canvas id="diagram-canvas-${diagram.id}" width="1200" height="350"></canvas>
</div>
</div>
<div class="diagram-actions-row">
<button type="button" class="reserva-btn" style="${adminOnlyStyle}" data-diagram-id="${diagram.id}">RESERVA</button>
${backupHtml}
</div>
`;
            return div;
        }
        // Handle canvas click
        document.addEventListener('DOMContentLoaded', function () {
            const checkAttendanceBtn = document.getElementById('check-attendance-btn');
            if (checkAttendanceBtn) {
                checkAttendanceBtn.addEventListener('click', function () { EVENTS.openCheckAttendanceDialog(); });
            }
            const checkAttendanceCloseBtn = document.getElementById('check-attendance-close-btn');
            if (checkAttendanceCloseBtn) {
                checkAttendanceCloseBtn.addEventListener('click', function () { EVENTS.closeCheckAttendanceDialog(); });
            }
            const checkAttendanceSubmitBtn = document.getElementById('check-attendance-submit-btn');
            if (checkAttendanceSubmitBtn) {
                checkAttendanceSubmitBtn.addEventListener('click', function () { EVENTS.checkFormAttendance(); });
            }

            const dialog = document.getElementById('person-dialog');
            const personCombo = document.getElementById('person-combo');
            const personList = document.getElementById('person-list');
            const personLoading = document.getElementById('person-loading');
            const danceCombo = document.getElementById('dance-combo');
            const danceDropdown = document.getElementById('dance-dropdown');
            const addDanceBtn = document.getElementById('add-dance-btn');
            const clearPersonBtn = document.getElementById('clear-person-btn');
            const diagramsList = document.getElementById('diagrams-list');
            // Use window variables for selection state to share with javascript.html handlers
            window.selectedDiagramId = null;
            window.selectedGroup = null;
            window.selectedSquare = null;
            window.currentOptions = [];
            window.isSelectingBackup = false;

            let allDances = [];
            let selectedDanceName = '';

            function loadDancesData() {
                API.getDances()
                    .then(function (dances) {
                        if (Array.isArray(dances) && dances.length > 0) {
                            allDances = dances;
                        }
                    })
                    .catch(function (error) {
                        console.error('Error loading dances:', error);
                    });
            }

            function renderDanceDropdown(filter) {
                if (!danceDropdown) return;
                const query = (filter || '').toLowerCase();
                const filtered = query
                    ? allDances.filter(d => d.name.toLowerCase().includes(query))
                    : allDances;
                danceDropdown.innerHTML = '';
                if (filtered.length === 0) {
                    if (query && allDances.length > 0) {
                        const li = document.createElement('li');
                        li.textContent = 'Cap resultat';
                        li.className = 'dance-dropdown-empty';
                        danceDropdown.appendChild(li);
                        danceDropdown.style.display = 'block';
                    } else {
                        danceDropdown.style.display = 'none';
                    }
                    return;
                }
                filtered.forEach(function (dance) {
                    const li = document.createElement('li');
                    li.textContent = dance.name;
                    li.dataset.value = dance.name;
                    li.addEventListener('mousedown', function (e) {
                        e.preventDefault();
                        selectDance(dance.name);
                    });
                    danceDropdown.appendChild(li);
                });
                danceDropdown.style.display = 'block';
            }

            function selectDance(name) {
                selectedDanceName = name;
                if (danceCombo) danceCombo.value = name;
                if (danceDropdown) danceDropdown.style.display = 'none';
                if (addDanceBtn) addDanceBtn.disabled = false;
            }

            if (danceCombo) {
                danceCombo.addEventListener('input', function () {
                    selectedDanceName = '';
                    addDanceBtn.disabled = true;
                    renderDanceDropdown(danceCombo.value);
                });
                danceCombo.addEventListener('focus', function () {
                    renderDanceDropdown(danceCombo.value);
                });
                danceCombo.addEventListener('blur', function () {
                    setTimeout(function () {
                        if (danceDropdown) danceDropdown.style.display = 'none';
                    }, 150);
                });
            }

            if (addDanceBtn) {
                addDanceBtn.addEventListener('click', function () {
                    if (selectedDanceName) {
                        addDanceFromChip(selectedDanceName);
                        selectedDanceName = '';
                        if (danceCombo) danceCombo.value = '';
                        addDanceBtn.disabled = true;
                    }
                });
            }

            // Add new diagram from chip click
            function addDanceFromChip(danceName) {
                if (!danceName) return;

                const danceInfo = DANCES.find(d => d.name === danceName);
                const structure = danceInfo && danceInfo.structure ? danceInfo.structure : { rows: 2, columns: 2 };
                const rows = structure ? structure.rows : 2;
                const cols = structure ? structure.columns : 2;
                const positions = danceInfo ? danceInfo.positions : [];
                const diagramData = danceInfo ? danceInfo.diagram : { backgroundColor: {}, textColor: {} };
                const minGroups = danceInfo && danceInfo.minGroups ? danceInfo.minGroups : 1;
                const cellCount = rows * cols;

                // Create initial groups based on minGroups
                const initialGroups = [];
                for (let i = 0; i < minGroups; i++) {
                    initialGroups.push(Array(cellCount).fill(null));
                }

                const newDiagram = {
                    id: diagramIdCounter++,
                    danceName: danceName,
                    description: '',
                    rows: rows,
                    columns: cols,
                    positions: positions,
                    diagram: diagramData,
                    groups: initialGroups,
                    forms: structure.forms || ['grid'],
                    backup: []
                };
                diagrams.push(newDiagram);
                setDiagramsDirty(true);

                const element = createDiagramElement(newDiagram);
                diagramsList.appendChild(element);

                // Setup canvas click handler for the new diagram
                setupCanvasClickHandler(newDiagram.id);

                drawDiagram(newDiagram);

                // Scroll to the new diagram
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            // Setup canvas click handler for a diagram
            function setupCanvasClickHandler(diagramId) {
                const canvas = document.getElementById('diagram-canvas-' + diagramId);
                if (!canvas) return;

                canvas.addEventListener('click', function (e) {
                    const userRoles = (APP && APP.currentUser && APP.currentUser.roles) || [];
                    if (!userRoles.includes('ADMIN')) return;

                    const diagram = diagrams.find(d => d.id === diagramId);
                    if (!diagram) return;

                    const rect = canvas.getBoundingClientRect();
                    const groups = diagram.groups;
                    const rows = diagram.rows || 2;
                    const cols = diagram.columns || 2;
                    const groupCount = groups.length;

                    // Use the same layout calculation as drawing
                    const layout = calcDiagramLayout(canvas, groupCount, rows, cols);
                    const { squareWidth, squareHeight, squareSpacingX, squareSpacingY, spacing, gridWidth, offsetX0, offsetY } = layout;

                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const clickX = (e.clientX - rect.left) * scaleX;
                    const clickY = (e.clientY - rect.top) * scaleY;

                    const forms = diagram.forms || ['grid'];
                    const activeForm = diagram.activeForm || forms[0];
                    if (activeForm === 'radial') {
                        const rl = calcRadialDiagramLayout(canvas, groupCount, rows, cols);
                        for (let g = 0; g < groupCount; g++) {
                            const angle = -Math.PI / 2 + (2 * Math.PI * g) / groupCount;
                            const groupCenterX = rl.centerX + rl.radius * Math.cos(angle);
                            const groupCenterY = rl.centerY + rl.radius * Math.sin(angle);
                            for (let row = 0; row < rows; row++) {
                                for (let col = 0; col < cols; col++) {
                                    const cx = groupCenterX;
                                    const cy = groupCenterY - rl.coupleHeight / 2 + row * (rl.cellHeight + rl.coupleGap) + rl.cellHeight / 2;
                                    const cellX = cx - rl.cellWidth / 2;
                                    const cellY = cy - rl.cellHeight / 2;
                                    if (clickX >= cellX && clickX <= cellX + rl.cellWidth && clickY >= cellY && clickY <= cellY + rl.cellHeight) {
                                        const idx = row * cols + col;
                                        window.selectedDiagramId = diagramId;
                                        window.selectedGroup = g;
                                        window.selectedSquare = idx;
                                        if (!MEMBERS.membersData || MEMBERS.membersData.length === 0) {
                                            setDialogLoading(true);
                                            UI.showDialogWithBackdrop(dialog);
                                            const checkInterval = setInterval(function () {
                                                if (MEMBERS.membersData && MEMBERS.membersData.length > 0) {
                                                    clearInterval(checkInterval);
                                                    setDialogLoading(false);
                                                    populatePersonList(diagramId, g, idx);
                                                }
                                            }, 200);
                                            return;
                                        }
                                        setDialogLoading(false);
                                        populatePersonList(diagramId, g, idx);
                                        return;
                                    }
                                }
                            }
                        }
                        return;
                    }

                    for (let g = 0; g < groupCount; g++) {
                        const offsetX = offsetX0 + g * (gridWidth + spacing);
                        const groupAreaWidth = squareWidth * cols + squareSpacingX * (cols - 1);
                        const groupAreaHeight = squareHeight * rows + squareSpacingY * (rows - 1);
                        if (
                            clickX >= offsetX && clickX <= offsetX + groupAreaWidth &&
                            clickY >= offsetY && clickY <= offsetY + groupAreaHeight
                        ) {
                            const x = clickX - offsetX;
                            const y = clickY - offsetY;
                            const col = Math.floor(x / (squareWidth + squareSpacingX));
                            const row = Math.floor(y / (squareHeight + squareSpacingY));
                            if (col >= cols || row >= rows) return;
                            const idx = row * cols + col;
                            window.selectedDiagramId = diagramId;
                            window.selectedGroup = g;
                            window.selectedSquare = idx;

                            if (!MEMBERS.membersData || MEMBERS.membersData.length === 0) {
                                setDialogLoading(true);
                                UI.showDialogWithBackdrop(dialog);
                                const checkInterval = setInterval(function () {
                                    if (MEMBERS.membersData && MEMBERS.membersData.length > 0) {
                                        clearInterval(checkInterval);
                                        setDialogLoading(false);
                                        populatePersonList(diagramId, g, idx);
                                    }
                                }, 200);
                                return;
                            }

                            setDialogLoading(false);
                            populatePersonList(diagramId, g, idx);
                            return;
                        }
                    }
                });
            }

            // Load dances data on initialization
            loadDancesData();

            // Member position overlay toggle
            const overlayToggleBtn = document.getElementById('member-position-overlay-toggle');
            if (overlayToggleBtn) {
                overlayToggleBtn.addEventListener('click', function () {
                    const overlay = document.getElementById('member-position-overlay');
                    if (overlay) {
                        overlay.classList.toggle('collapsed');
                        overlayToggleBtn.textContent = overlay.classList.contains('collapsed') ? '+' : '−';
                    }
                });
            }

            // Event name and datetime validation - show dance selection when both filled
            const eventNameInput = document.getElementById('event-name-input');
            const eventDatetimeInput = document.getElementById('event-datetime-input');
            const eventMeetingPlaceInput = document.getElementById('event-meeting-place-input');
            const danceSelectorSection = document.getElementById('dance-selector-section');

            function checkEventFieldsAndShowDances() {
                const nameValid = eventNameInput.value.trim().length > 0;
                const dateValid = eventDatetimeInput.value.length > 0;
                if (nameValid && dateValid) {
                    danceSelectorSection.style.display = 'flex';
                } else {
                    danceSelectorSection.style.display = 'none';
                }
                // Check if event is in the past and update editability
                applyEditableState();
                // Mark event data as dirty when any event field changes
                setDiagramsDirty(true);
            }

            eventNameInput.addEventListener('input', checkEventFieldsAndShowDances);
            eventDatetimeInput.addEventListener('input', checkEventFieldsAndShowDances);
            if (eventMeetingPlaceInput) {
                eventMeetingPlaceInput.addEventListener('input', checkEventFieldsAndShowDances);
            }

            // Helper to show/hide loading state in dialog
            function setDialogLoading(isLoading) {
                personLoading.style.display = isLoading ? 'block' : 'none';
                personCombo.style.display = isLoading ? 'none' : 'block';
            }

            // Helper to populate the person list for backup selection
            function populatePersonListForBackup(diagramId) {
                const diagram = diagrams.find(d => d.id === diagramId);
                if (!diagram) return;

                // Determine position info text for backup
                const reservaText = 'RESERVA - ' + diagram.danceName;

                // Get all members already used in the diagram
                const cellCount = (diagram.rows || 2) * (diagram.columns || 2);
                let usedIds = [];
                for (let gi = 0; gi < diagram.groups.length; gi++) {
                    for (let si = 0; si < cellCount; si++) {
                        if (diagram.groups[gi][si]) usedIds.push(diagram.groups[gi][si]);
                    }
                }

                // Also include members already in backup
                if (diagram.backup) {
                    usedIds = usedIds.concat(diagram.backup);
                }

                // Check if event is in the past - if so, include inactive members
                let isEventInPast = false;
                const eventDateValue = eventDatetimeInput.value;
                if (eventDateValue) {
                    const eventDate = new Date(eventDateValue);
                    const now = new Date();
                    isEventInPast = eventDate < now;
                }

                // Filter members: only active for future events, all for past events
                const personAliases = MEMBERS.membersData
                    .filter(m => isEventInPast || m.active)
                    .map(m => m.alias)
                    .filter(Boolean);
                window.currentOptions = personAliases.filter(id => !usedIds.includes(id));
                personList.innerHTML = '';

                if (window.currentOptions.length === 0) {
                    personCombo.style.display = 'none';
                    personList.classList.remove('open');
                    personLoading.style.display = 'block';
                    personLoading.querySelector('.dialog-spinner').style.display = 'none';
                    personLoading.querySelector('p').textContent = 'No hi ha membres disponibles';
                } else {
                    personCombo.style.display = 'block';
                    personLoading.style.display = 'none';
                    personLoading.querySelector('.dialog-spinner').style.display = 'block';
                    personLoading.querySelector('p').textContent = 'Carregant membres...';
                    personCombo.placeholder = 'Cerca o selecciona...';
                    personCombo.disabled = false;
                    // Populate dropdown with all options initially
                    updateDropdownOptions(window.currentOptions);
                }

                personCombo.value = '';
                clearPersonBtn.style.display = 'none';
                
                // Set position-info BEFORE showing dialog
                const positionInfo = document.getElementById('position-info');
                if (positionInfo) {
                    positionInfo.textContent = reservaText;
                    positionInfo.style.display = 'block';
                    console.log('populatePersonListForBackup - after setting textContent:', positionInfo.textContent);
                }
                
                // Only show dialog if it's not already open
                if (!dialog.open) {
                    UI.showDialogWithBackdrop(dialog);
                }
                
                // Focus and show dropdown
                personCombo.focus();
                personList.classList.add('open');
            }

            // Helper to populate the person list
            function populatePersonList(diagramId, g, squareIdx) {
                const diagram = diagrams.find(d => d.id === diagramId);
                if (!diagram) return;

                const positions = diagram.positions || [];
                const order = squareIdx + 1;
                const pos = positions.find(function (p) { return p.order === order; });
                const groupLetter = String.fromCharCode(65 + g);
                const diagramColors = diagram.diagram || {};
                const blockName = diagramColors.blockName || 'Grup';

                // Determine position info text
                let positionInfoText = blockName + ' ' + groupLetter;
                if (pos && pos.specifications) {
                    positionInfoText = pos.specifications;
                } else if (pos && pos.positionType && pos.positionType.label) {
                    positionInfoText = pos.positionType.label;
                }

                const cellCount = (diagram.rows || 2) * (diagram.columns || 2);
                let usedIds = [];
                for (let gi = 0; gi < diagram.groups.length; gi++) {
                    for (let si = 0; si < cellCount; si++) {
                        if (gi === g && si === squareIdx) continue;
                        if (diagram.groups[gi][si]) usedIds.push(diagram.groups[gi][si]);
                    }
                }

                // Check if event is in the past - if so, include inactive members
                let isEventInPast = false;
                const eventDateValue = eventDatetimeInput.value;
                if (eventDateValue) {
                    const eventDate = new Date(eventDateValue);
                    const now = new Date();
                    isEventInPast = eventDate < now;
                }

                // Filter members: only active for future events, all for past events
                const personAliases = MEMBERS.membersData
                    .filter(m => isEventInPast || m.active)
                    .map(m => m.alias)
                    .filter(Boolean);
                window.currentOptions = personAliases.filter(id => !usedIds.includes(id) || diagram.groups[g][squareIdx] === id);
                personList.innerHTML = '';

                if (window.currentOptions.length === 0) {
                    personCombo.style.display = 'none';
                    personList.classList.remove('open');
                    personLoading.style.display = 'block';
                    personLoading.querySelector('.dialog-spinner').style.display = 'none';
                    personLoading.querySelector('p').textContent = 'No hi ha membres disponibles';
                } else {
                    personCombo.style.display = 'block';
                    personLoading.style.display = 'none';
                    personLoading.querySelector('.dialog-spinner').style.display = 'block';
                    personLoading.querySelector('p').textContent = 'Carregant membres...';
                    personCombo.placeholder = 'Cerca o selecciona...';
                    personCombo.disabled = false;
                    // Populate dropdown with all options initially
                    updateDropdownOptions(window.currentOptions);
                }

                personCombo.value = diagram.groups[g][squareIdx] || '';
                clearPersonBtn.style.display = diagram.groups[g][squareIdx] ? 'block' : 'none';
                
                // Set position-info BEFORE showing dialog
                const positionInfo = document.getElementById('position-info');
                if (positionInfo) {
                    positionInfo.textContent = positionInfoText;
                    positionInfo.style.display = 'block';
                }
                
                // Only show dialog if it's not already open
                if (!dialog.open) {
                    UI.showDialogWithBackdrop(dialog);
                }

                selectedCellHighlight = { diagramId: diagram.id, groupIdx: g, cellIdx: squareIdx };
                drawDiagram(diagram);
                
                // Focus and show dropdown only if position is empty
                personCombo.focus();
                if (!diagram.groups[g][squareIdx]) {
                    personList.classList.add('open');
                }
            }

            // Handle clear button click
            clearPersonBtn.addEventListener('click', function () {
                if (window.isSelectingBackup) {
                    // Can't clear backup from dialog, need to use remove button
                    return;
                }
                if (window.selectedDiagramId !== null && window.selectedGroup !== null && window.selectedSquare !== null) {
                    const diagram = diagrams.find(d => d.id === window.selectedDiagramId);
                    if (diagram) {
                        diagram.groups[window.selectedGroup][window.selectedSquare] = null;
                        setDiagramsDirty(true);
                        drawDiagram(diagram);
                        personCombo.value = '';
                        clearPersonBtn.style.display = 'none';
                    }
                }
            });

            // Handle dialog form - auto-submit when a valid ID is selected
            // If openNextBlock is true, automatically open the dialog for the next empty block
            function handlePersonSelection(openNextBlock) {
                const id = personCombo.value.trim();
                if (!id || !window.currentOptions.includes(id)) return;

                // Handle backup selection
                if (window.isSelectingBackup && window.selectedDiagramId !== null) {
                    const diagram = diagrams.find(d => d.id === window.selectedDiagramId);
                    if (diagram) {
                        if (!diagram.backup) diagram.backup = [];
                        diagram.backup.push(id);
                        setDiagramsDirty(true);
                        // Re-render the diagram element to show the backup member
                        const oldElement = document.getElementById('diagram-item-' + window.selectedDiagramId);
                        if (oldElement) {
                            const newElement = createDiagramElement(diagram);
                            oldElement.replaceWith(newElement);
                            setupCanvasClickHandler(window.selectedDiagramId);
                            drawDiagram(diagram);
                        }
                        window.isSelectingBackup = false;
                        selectedCellHighlight = null;
                        drawDiagram(diagram);
                        UI.closeDialogWithBackdrop(dialog);
                    }
                    return;
                }

                // Handle regular position selection
                if (window.selectedDiagramId !== null && window.selectedGroup !== null && window.selectedSquare !== null) {
                    const diagram = diagrams.find(d => d.id === window.selectedDiagramId);
                    if (diagram) {
                        diagram.groups[window.selectedGroup][window.selectedSquare] = id;
                        
                        // Remove person from backup list if they were in it
                        if (diagram.backup && diagram.backup.includes(id)) {
                            diagram.backup = diagram.backup.filter(m => m !== id);
                            // Re-render the diagram element to update the backup list
                            const oldElement = document.getElementById('diagram-item-' + window.selectedDiagramId);
                            if (oldElement) {
                                const newElement = createDiagramElement(diagram);
                                oldElement.replaceWith(newElement);
                                setupCanvasClickHandler(window.selectedDiagramId);
                            }
                        }
                        
                        setDiagramsDirty(true);
                        selectedCellHighlight = { diagramId: diagram.id, groupIdx: window.selectedGroup, cellIdx: window.selectedSquare };
                        drawDiagram(diagram);

                        // If openNextBlock is true, find and open the next empty block
                        if (openNextBlock) {
                            const cellCount = (diagram.rows || 2) * (diagram.columns || 2);
                            let nextEmptyIdx = -1;

                            // Search for the next empty block starting from current position + 1
                            for (let i = window.selectedSquare + 1; i < cellCount; i++) {
                                if (!diagram.groups[window.selectedGroup][i]) {
                                    nextEmptyIdx = i;
                                    break;
                                }
                            }

                            // If found an empty block, open dialog for it
                            if (nextEmptyIdx !== -1) {
                                window.selectedSquare = nextEmptyIdx;
                                populatePersonList(window.selectedDiagramId, window.selectedGroup, nextEmptyIdx);
                                return; // Don't close the dialog, it's already re-opened
                            }
                        }

                        selectedCellHighlight = null;
                        drawDiagram(diagram);
                        UI.closeDialogWithBackdrop(dialog);
                    }
                }
            }

            personCombo.addEventListener('input', function () { handlePersonSelection(false); });
            personCombo.addEventListener('change', function () { handlePersonSelection(false); });

            // Helper function to normalize text by removing accents
            function normalizeText(text) {
                return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            }

            // Track highlighted index for keyboard navigation
            let highlightedIndex = -1;

            function updateDropdownOptions(options) {
                personList.innerHTML = '';
                highlightedIndex = -1;
                options.forEach(function (id, index) {
                    const li = document.createElement('li');
                    li.textContent = id;
                    li.dataset.value = id;
                    li.addEventListener('click', function () {
                        personCombo.value = id;
                        personList.classList.remove('open');
                        handlePersonSelection(true);
                    });
                    personList.appendChild(li);
                });
            }

            // Filter dropdown options as user types (accent-insensitive)
            personCombo.addEventListener('input', function () {
                const typedValue = normalizeText(personCombo.value.trim());

                let filteredOptions;
                if (typedValue === '') {
                    filteredOptions = window.currentOptions;
                } else {
                    filteredOptions = window.currentOptions.filter(function (id) {
                        return normalizeText(id).includes(typedValue);
                    });
                }

                updateDropdownOptions(filteredOptions);
                personList.classList.add('open');
            });

            // Show dropdown on focus
            personCombo.addEventListener('focus', function () {
                if (personCombo.value && window.selectedDiagramId !== null && !window.isSelectingBackup) {
                    return;
                }
                const typedValue = normalizeText(personCombo.value.trim());
                let filteredOptions;
                if (typedValue === '') {
                    filteredOptions = window.currentOptions;
                } else {
                    filteredOptions = window.currentOptions.filter(function (id) {
                        return normalizeText(id).includes(typedValue);
                    });
                }
                updateDropdownOptions(filteredOptions);
                if (filteredOptions.length > 0) {
                    personList.classList.add('open');
                }
            });

            // Hide dropdown when clicking outside
            document.addEventListener('click', function (e) {
                if (!personCombo.contains(e.target) && !personList.contains(e.target)) {
                    personList.classList.remove('open');
                }
            });

            // Handle Enter key and keyboard navigation
            personCombo.addEventListener('keydown', function (e) {
                const items = personList.querySelectorAll('li');

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
                    updateHighlight(items);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    highlightedIndex = Math.max(highlightedIndex - 1, 0);
                    updateHighlight(items);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (highlightedIndex >= 0 && items[highlightedIndex]) {
                        personCombo.value = items[highlightedIndex].dataset.value;
                        personList.classList.remove('open');
                        handlePersonSelection(true);
                    } else {
                        // Auto-select if only one match
                        const typedValue = normalizeText(personCombo.value.trim());
                        const matchingOptions = window.currentOptions.filter(name =>
                            normalizeText(name).includes(typedValue)
                        );
                        if (matchingOptions.length === 1) {
                            personCombo.value = matchingOptions[0];
                            personList.classList.remove('open');
                            handlePersonSelection(true);
                        }
                    }
                } else if (e.key === 'Escape') {
                    personList.classList.remove('open');
                }
            });

            function updateHighlight(items) {
                items.forEach(function (item, index) {
                    item.classList.toggle('highlighted', index === highlightedIndex);
                });
                // Scroll highlighted item into view
                if (items[highlightedIndex]) {
                    items[highlightedIndex].scrollIntoView({ block: 'nearest' });
                }
            }

            // Drag and drop functionality for reordering diagrams
            let draggedItem = null;

            diagramsList.addEventListener('dragstart', function (e) {
                const item = e.target.closest('.diagram-item');
                if (!item) return;
                draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.dataset.diagramId);
            });

            diagramsList.addEventListener('dragend', function (e) {
                const item = e.target.closest('.diagram-item');
                if (item) {
                    item.classList.remove('dragging');
                }
                // Remove drag-over class from all items
                diagramsList.querySelectorAll('.diagram-item').forEach(function (el) {
                    el.classList.remove('drag-over');
                });
                draggedItem = null;
            });

            diagramsList.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const targetItem = e.target.closest('.diagram-item');
                if (targetItem && targetItem !== draggedItem) {
                    // Remove drag-over from all, add to current target
                    diagramsList.querySelectorAll('.diagram-item').forEach(function (el) {
                        el.classList.remove('drag-over');
                    });
                    targetItem.classList.add('drag-over');
                }
            });

            diagramsList.addEventListener('dragleave', function (e) {
                const targetItem = e.target.closest('.diagram-item');
                if (targetItem && !targetItem.contains(e.relatedTarget)) {
                    targetItem.classList.remove('drag-over');
                }
            });

            diagramsList.addEventListener('drop', function (e) {
                e.preventDefault();
                const targetItem = e.target.closest('.diagram-item');
                if (!targetItem || !draggedItem || targetItem === draggedItem) return;

                // Get positions in DOM
                const items = Array.from(diagramsList.querySelectorAll('.diagram-item'));
                const draggedIndex = items.indexOf(draggedItem);
                const targetIndex = items.indexOf(targetItem);

                // Reorder DOM
                if (draggedIndex < targetIndex) {
                    targetItem.after(draggedItem);
                } else {
                    targetItem.before(draggedItem);
                }

                // Reorder diagrams array to match DOM order
                const newItems = Array.from(diagramsList.querySelectorAll('.diagram-item'));
                const newDiagrams = [];
                newItems.forEach(function (el) {
                    const id = parseInt(el.dataset.diagramId);
                    const diagram = diagrams.find(d => d.id === id);
                    if (diagram) newDiagrams.push(diagram);
                });
                diagrams = newDiagrams;
                setDiagramsDirty(true);

                // Clean up
                targetItem.classList.remove('drag-over');
            });

            // Event delegation for add group and remove diagram buttons
            diagramsList.addEventListener('click', function (e) {
                // Add description link
                if (e.target.classList.contains('add-description-link')) {
                    e.preventDefault();
                    const diagramId = parseInt(e.target.dataset.id);
                    const input = document.getElementById('desc-input-' + diagramId);
                    if (input) {
                        e.target.style.display = 'none';
                        input.style.display = 'block';
                        input.focus();
                    }
                }
                // Edit description button
                if (e.target.closest('.edit-description-btn')) {
                    const btn = e.target.closest('.edit-description-btn');
                    const diagramId = parseInt(btn.dataset.id);
                    const input = document.getElementById('desc-input-' + diagramId);
                    const text = document.getElementById('desc-text-' + diagramId);
                    if (input && text) {
                        text.style.display = 'none';
                        btn.style.display = 'none';
                        input.style.display = 'block';
                        input.focus();
                    }
                }
                // Add group button
                if (e.target.classList.contains('add-group-btn')) {
                    const diagramId = parseInt(e.target.dataset.id);
                    const diagram = diagrams.find(d => d.id === diagramId);
                    if (diagram) {
                        const cellCount = (diagram.rows || 2) * (diagram.columns || 2);
                        diagram.groups.push(Array(cellCount).fill(null));
                        setDiagramsDirty(true);
                        drawDiagram(diagram);
                    }
                }
                // Remove diagram button
                if (e.target.classList.contains('remove-diagram-btn')) {
                    const diagramId = parseInt(e.target.dataset.id);
                    const diagram = diagrams.find(d => d.id === diagramId);
                    if (diagram && confirm('Segur que vols eliminar el ball "' + diagram.danceName + '"?')) {
                        diagrams = diagrams.filter(d => d.id !== diagramId);
                        const element = document.getElementById('diagram-item-' + diagramId);
                        if (element) element.remove();
                        setDiagramsDirty(true);
                    }
                }
                // RESERVA button
                if (e.target.classList.contains('reserva-btn')) {
                    const diagramId = parseInt(e.target.dataset.diagramId);
                    const diagram = diagrams.find(d => d.id === diagramId);
                    if (!diagram) return;

                    // Set selection state for backup
                    window.selectedDiagramId = diagramId;
                    window.selectedGroup = null;
                    window.selectedSquare = null;
                    window.isSelectingBackup = true;

                    if (!MEMBERS.membersData || MEMBERS.membersData.length === 0) {
                        setDialogLoading(true);
                        UI.showDialogWithBackdrop(dialog);
                        const checkInterval = setInterval(function () {
                            if (MEMBERS.membersData && MEMBERS.membersData.length > 0) {
                                clearInterval(checkInterval);
                                setDialogLoading(false);
                                populatePersonListForBackup(diagramId);
                            }
                        }, 200);
                        return;
                    }

                    setDialogLoading(false);
                    populatePersonListForBackup(diagramId);
                }
                // Remove backup button
                if (e.target.classList.contains('remove-backup-btn')) {
                    const diagramId = parseInt(e.target.dataset.diagramId);
                    const memberAlias = e.target.dataset.member;
                    const diagram = diagrams.find(d => d.id === diagramId);
                    if (diagram) {
                        diagram.backup = diagram.backup.filter(m => m !== memberAlias);
                        setDiagramsDirty(true);
                        // Re-render the diagram element
                        const oldElement = document.getElementById('diagram-item-' + diagramId);
                        if (oldElement) {
                            const newElement = createDiagramElement(diagram);
                            oldElement.replaceWith(newElement);
                            setupCanvasClickHandler(diagramId);
                            drawDiagram(diagram);
                        }
                    }
                }
                // Form toggle button
                if (e.target.classList.contains('form-toggle-btn')) {
                    const diagramId = parseInt(e.target.dataset.diagramId);
                    const form = e.target.dataset.form;
                    const diagram = diagrams.find(d => d.id === diagramId);
                    if (diagram) {
                        diagram.activeForm = form;
                        const container = e.target.closest('.diagram-form-toggle');
                        if (container) {
                            container.querySelectorAll('.form-toggle-btn').forEach(function (btn) {
                                btn.classList.toggle('active', btn.dataset.form === form);
                            });
                        }
                        drawDiagram(diagram);
                    }
                }
                // Magic generated button
                if (e.target.closest('.magic-generated-btn')) {
                    const btn = e.target.closest('.magic-generated-btn');
                    const diagramId = parseInt(btn.dataset.id);
                    const diagram = diagrams.find(d => d.id === diagramId);
                    if (!diagram) return;

                    const magicDialog = document.getElementById('magic-dialog');
                    const magicContent = magicDialog.querySelector('.magic-dialog-content');
                    if (!magicDialog) return;

                    magicContent.innerHTML = '<div class="magic-dialog-spinner"></div><p class="magic-dialog-text">Calculant</p>';
                    UI.showDialogWithBackdrop(magicDialog);

                    const attendees = (APP.currentEventData && APP.currentEventData.attendees) || [];
                    API.calculateEventDancePositions({ danceName: diagram.danceName, attendees: attendees })
                        .then(function (result) {
                            var html = '<h3 class="magic-dialog-title">' + diagram.danceName + '</h3>';
                            var orders = Object.keys(result).sort(function (a, b) { return parseInt(a) - parseInt(b); });
                            if (orders.length === 0) {
                                html += '<p class="magic-dialog-empty">No hi ha dades d\'actuacions anteriors</p>';
                            } else {
                                html += '<canvas id="diagram-canvas-magic" width="800" height="400"></canvas>';
                                html += '<div id="magic-selection-area"></div>';
                                html += '<button type="button" id="magic-confirm-btn" class="magic-confirm-btn">Confirmar</button>';
                            }
                            var closeBtn = '<button type="button" class="magic-dialog-close-btn" onclick="UI.closeDialogWithBackdrop(document.getElementById(\'magic-dialog\'))" aria-label="Tancar"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>';
                            magicContent.innerHTML = closeBtn + html;
                            if (orders.length > 0) {
                                var rows = diagram.rows || 2;
                                var cols = diagram.columns || 2;
                                var positionsPerGroup = rows * cols;
                                var groupCount = diagram.groups.length;
                                var magicGroups = [];
                                for (var g = 0; g < groupCount; g++) {
                                    var group = [];
                                    for (var i = 0; i < positionsPerGroup; i++) group.push(null);
                                    magicGroups.push(group);
                                }
                                var magicDiagram = {
                                    id: 'magic',
                                    groups: magicGroups,
                                    rows: rows,
                                    columns: cols,
                                    positions: diagram.positions || [],
                                    diagram: diagram.diagram || { backgroundColor: {}, textColor: {} },
                                    forms: ['grid'],
                                    activeForm: 'grid'
                                };
                                drawDiagram(magicDiagram);

                                function showMagicCandidates(order, groupIdx, cellIdx) {
                                    selectedCellHighlight = { diagramId: 'magic', groupIdx: groupIdx, cellIdx: cellIdx };
                                    drawDiagram(magicDiagram);
                                    var selectionArea = document.getElementById('magic-selection-area');
                                    var posResult = result[order];
                                    var pos = magicDiagram.positions.find(function (p) { return p.order === order; });
                                    var dColors = magicDiagram.diagram;
                                    var bgColor = '#808080';
                                    if (pos && pos.positionType.label && dColors.backgroundColor && dColors.backgroundColor[pos.positionType.label]) {
                                        bgColor = dColors.backgroundColor[pos.positionType.label];
                                    }
                                    var usedAliases = [];
                                    for (var gi = 0; gi < magicDiagram.groups.length; gi++) {
                                        for (var si = 0; si < positionsPerGroup; si++) {
                                            if (gi === groupIdx && si === cellIdx) continue;
                                            if (magicDiagram.groups[gi][si]) usedAliases.push(magicDiagram.groups[gi][si]);
                                        }
                                    }
                                    var groupLetter = String.fromCharCode(65 + groupIdx);
                                    var blockName = dColors.blockName || 'Grup';
                                    var headerText = pos ? pos.tag : 'Posició ' + order;
                                    if (magicDiagram.groups.length > 1) {
                                        headerText += ' — ' + blockName + ' ' + groupLetter;
                                    }
                                    var areaHtml = '<div class="magic-selection-header">';
                                    areaHtml += '<span class="magic-position-color" style="background:' + bgColor + '"></span>';
                                    areaHtml += '<strong>' + headerText + '</strong>';
                                    if (pos && pos.specifications) {
                                        areaHtml += '<span class="magic-position-specs">' + pos.specifications + '</span>';
                                    }
                                    areaHtml += '</div>';
                                    var currentAssigned = magicDiagram.groups[groupIdx][cellIdx];
                                    if (currentAssigned) {
                                        areaHtml += '<div class="magic-current-assignment">';
                                        areaHtml += '<span>' + currentAssigned + '</span>';
                                        areaHtml += '<button type="button" class="magic-remove-btn" title="Eliminar">✕</button>';
                                        areaHtml += '</div>';
                                    }
                                    if (!posResult || !posResult.members || posResult.members.length === 0) {
                                        areaHtml += '<p class="magic-dialog-empty">No hi ha dades per a aquesta posició</p>';
                                        selectionArea.innerHTML = areaHtml;
                                        return;
                                    }
                                    var candidates = posResult.members.filter(function (m) {
                                        return m.attending && !usedAliases.includes(m.name);
                                    });
                                    if (candidates.length === 0) {
                                        areaHtml += '<p class="magic-dialog-empty">No hi ha candidats disponibles</p>';
                                    } else {
                                        areaHtml += '<div class="magic-candidate-list">';
                                        candidates.forEach(function (m, idx) {
                                            areaHtml += '<button type="button" class="magic-candidate-btn" data-idx="' + idx + '">';
                                            areaHtml += m.name + ' <strong>' + m.count + '</strong>';
                                            areaHtml += '</button>';
                                        });
                                        areaHtml += '</div>';
                                    }
                                    selectionArea.innerHTML = areaHtml;
                                    selectionArea.querySelectorAll('.magic-candidate-btn').forEach(function (btn) {
                                        btn.addEventListener('click', function () {
                                            var candidate = candidates[parseInt(btn.dataset.idx)];
                                            magicDiagram.groups[groupIdx][cellIdx] = candidate.name;
                                            for (var ni = cellIdx + 1; ni < positionsPerGroup; ni++) {
                                                if (!magicDiagram.groups[groupIdx][ni]) {
                                                    showMagicCandidates(ni + 1, groupIdx, ni);
                                                    return;
                                                }
                                            }
                                            selectedCellHighlight = null;
                                            drawDiagram(magicDiagram);
                                            selectionArea.innerHTML = '';
                                        });
                                    });
                                    var removeBtn = selectionArea.querySelector('.magic-remove-btn');
                                    if (removeBtn) {
                                        removeBtn.addEventListener('click', function () {
                                            magicDiagram.groups[groupIdx][cellIdx] = null;
                                            drawDiagram(magicDiagram);
                                            showMagicCandidates(order, groupIdx, cellIdx);
                                        });
                                    }
                                }

                                var magicCanvas = document.getElementById('diagram-canvas-magic');
                                magicCanvas.addEventListener('click', function (e) {
                                    var rect = magicCanvas.getBoundingClientRect();
                                    var layout = calcDiagramLayout(magicCanvas, groupCount, rows, cols);
                                    var scaleX = magicCanvas.width / rect.width;
                                    var scaleY = magicCanvas.height / rect.height;
                                    var clickX = (e.clientX - rect.left) * scaleX;
                                    var clickY = (e.clientY - rect.top) * scaleY;
                                    for (var g = 0; g < groupCount; g++) {
                                        var offsetX = layout.offsetX0 + g * (layout.gridWidth + layout.spacing);
                                        var groupAreaWidth = layout.squareWidth * cols + layout.squareSpacingX * (cols - 1);
                                        var groupAreaHeight = layout.squareHeight * rows + layout.squareSpacingY * (rows - 1);
                                        if (clickX >= offsetX && clickX <= offsetX + groupAreaWidth &&
                                            clickY >= layout.offsetY && clickY <= layout.offsetY + groupAreaHeight) {
                                            var x = clickX - offsetX;
                                            var y = clickY - layout.offsetY;
                                            var col = Math.floor(x / (layout.squareWidth + layout.squareSpacingX));
                                            var row = Math.floor(y / (layout.squareHeight + layout.squareSpacingY));
                                            if (col >= cols || row >= rows) return;
                                            var idx = row * cols + col;
                                            showMagicCandidates(idx + 1, g, idx);
                                            return;
                                        }
                                    }
                                });

                                document.getElementById('magic-confirm-btn').addEventListener('click', function () {
                                    for (var g = 0; g < groupCount; g++) {
                                        for (var i = 0; i < positionsPerGroup; i++) {
                                            diagram.groups[g][i] = magicDiagram.groups[g][i];
                                        }
                                    }
                                    setDiagramsDirty(true);
                                    selectedCellHighlight = null;
                                    drawDiagram(diagram);
                                    UI.closeDialogWithBackdrop(magicDialog);
                                });
                            }
                        })
                        .catch(function (error) {
                            var closeBtn = '<button type="button" class="magic-dialog-close-btn" onclick="UI.closeDialogWithBackdrop(document.getElementById(\'magic-dialog\'))" aria-label="Tancar"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>';
                            magicContent.innerHTML = closeBtn + '<p class="magic-dialog-error">Error: ' + error + '</p>';
                        });
                }
            });

            // Handle description input blur and enter key
            diagramsList.addEventListener('blur', function (e) {
                if (e.target.classList.contains('diagram-description-input')) {
                    saveDescriptionFromInput(e.target);
                }
            }, true);

            diagramsList.addEventListener('keydown', function (e) {
                if (e.target.classList.contains('diagram-description-input') && e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
                if (e.target.classList.contains('diagram-description-input') && e.key === 'Escape') {
                    e.preventDefault();
                    const diagramId = parseInt(e.target.id.replace('desc-input-', ''));
                    const diagram = diagrams.find(d => d.id === diagramId);
                    if (diagram) {
                        e.target.value = diagram.description || '';
                    }
                    e.target.blur();
                }
            });

            function saveDescriptionFromInput(input) {
                const diagramId = parseInt(input.id.replace('desc-input-', ''));
                const diagram = diagrams.find(d => d.id === diagramId);
                if (!diagram) return;

                const newDescription = input.value.trim();
                diagram.description = newDescription;
                setDiagramsDirty(true);

                // Re-render the diagram element to update the description UI
                const oldElement = document.getElementById('diagram-item-' + diagramId);
                if (oldElement) {
                    const newElement = createDiagramElement(diagram);
                    oldElement.replaceWith(newElement);
                    setupCanvasClickHandler(diagramId);
                    drawDiagram(diagram);
                }
            }

            // Close dialog when clicking outside or pressing Escape
            dialog.addEventListener('click', function (e) {
                if (e.target === dialog) {
                    selectedCellHighlight = null;
                    if (window.selectedDiagramId !== null) {
                        var d = diagrams.find(function (di) { return di.id === window.selectedDiagramId; });
                        if (d) drawDiagram(d);
                    }
                    UI.closeDialogWithBackdrop(dialog);
                }
            });

            // Floating save button functionality
            const floatingSaveBtn = document.getElementById('floating-save-btn');
            const saveIcon = floatingSaveBtn.querySelector('.save-icon');

            floatingSaveBtn.addEventListener('click', function () {
                // Validate required fields
                const eventName = eventNameInput.value.trim();
                const eventDatetime = eventDatetimeInput.value;
                const eventMeetingPlace = eventMeetingPlaceInput ? eventMeetingPlaceInput.value.trim() : '';

                if (!eventName) {
                    alert('Si us plau, introdueix el nom de l\'actuació.');
                    eventNameInput.focus();
                    return;
                }

                if (!eventDatetime) {
                    alert('Si us plau, introdueix la data de l\'actuació.');
                    eventDatetimeInput.focus();
                    return;
                }

                if (diagrams.length === 0) {
                    alert('Si us plau, afegeix almenys un ball.');
                    return;
                }

                // Prepare data for saving
                const eventData = {
                    name: eventName,
                    datetime: eventDatetime,
                    meetingPlace: eventMeetingPlace,
                    diagrams: diagrams.map(function (d) {
                        return {
                            danceName: d.danceName,
                            description: d.description || '',
                            rows: d.rows,
                            columns: d.columns,
                            positions: d.positions,
                            groups: d.groups,
                            backup: d.backup || []
                        };
                    })
                };

                // Show saving state
                floatingSaveBtn.disabled = true;
                floatingSaveBtn.classList.add('saving');
                saveIcon.innerHTML = '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="32" stroke-dashoffset="32"><animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/></circle>';

                // Call server-side function to save
                API.saveEvent({ event: eventData })
                    .then(function (result) {
                        floatingSaveBtn.classList.remove('saving');
                        floatingSaveBtn.classList.add('success');
                        saveIcon.innerHTML = '<polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>';
                        setDiagramsDirty(false);

                        CACHE.saveEvents({ events: null });
                        APP.bumpLocalVersion('events');
                        EVENTS.refreshPlanningEvents();

                        // Update URL hash with event ID so refresh works
                        if (result && result.sheetName) {
                            window.location.hash = 'events/' + encodeURIComponent(result.sheetName);
                            localStorage.setItem('currentRoute', 'events/' + encodeURIComponent(result.sheetName));
                        }

                        setTimeout(function () {
                            floatingSaveBtn.disabled = false;
                            floatingSaveBtn.classList.remove('success');
                            saveIcon.innerHTML = '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>';
                        }, 2000);
                    })
                    .catch(function (error) {
                        console.error('Error saving event:', error);
                        floatingSaveBtn.classList.remove('saving');
                        floatingSaveBtn.classList.add('error');
                        saveIcon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>';

                        setTimeout(function () {
                            floatingSaveBtn.disabled = false;
                            floatingSaveBtn.classList.remove('error');
                            saveIcon.innerHTML = '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>';
                        }, 3000);

                        alert('Error desant l\'actuació: ' + (error.message || error));
                    });
            });

            // Floating share button functionality
            const floatingShareBtn = document.getElementById('floating-share-btn');

            floatingShareBtn.addEventListener('click', async function () {
                if (diagrams.length === 0) {
                    alert('No hi ha cap ball per compartir.');
                    return;
                }

                floatingShareBtn.disabled = true;

                try {
                    // Get event name and date for the image header
                    const eventName = eventNameInput.value.trim() || document.getElementById('event-name-display').textContent || 'Actuació';
                    const eventDateValue = eventDatetimeInput.value;
                    let eventDateFormatted = '';
                    if (eventDateValue) {
                        const date = new Date(eventDateValue);
                        if (!isNaN(date.getTime())) {
                            eventDateFormatted = date.toLocaleDateString('ca-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        }
                    }

                    // Create separate image for each diagram
                    const files = [];

                    diagrams.forEach(function (diagram, index) {
                        const canvas = document.getElementById('diagram-canvas-' + diagram.id);
                        if (!canvas) return;

                        // Extract legend items (unique labels only)
                        const positions = diagram.positions || [];
                        const diagramColors = diagram.diagram || { backgroundColor: {}, textColor: {} };
                        const legendItems = [];
                        const seenLabels = new Set();
                        positions.forEach(function (pos) {
                            if (seenLabels.has(pos.positionType.label)) return;
                            seenLabels.add(pos.positionType.label);
                            const color = (diagramColors.backgroundColor && diagramColors.backgroundColor[pos.positionType.label]) || '#808080';
                            legendItems.push({
                                label: pos.positionType.label,
                                color: color
                            });
                        });
                        
                        // Calculate if legend should be shown (only if more than 1 item)
                        const showLegend = legendItems.length > 1;
                        const legendHeight = showLegend ? 45 : 0;

                        // Calculate height for this individual image
                        const headerHeight = 80;
                        const padding = 30;
                        const descriptionHeight = diagram.description ? 30 : 0;
                        const titleHeight = 35;
                        const backupMembers = Array.isArray(diagram.backup) ? diagram.backup.filter(Boolean) : [];
                        const backupText = backupMembers.length > 0 ? `Reserves: ${backupMembers.join(', ')}` : '';
                        const backupHeight = backupText ? 40 : 0;
                        const totalHeight = headerHeight + titleHeight + descriptionHeight + legendHeight + canvas.height + padding * 2 + backupHeight;

                        // Create a canvas for this diagram
                        const imageCanvas = document.createElement('canvas');
                        const ctx = imageCanvas.getContext('2d');
                        imageCanvas.width = 1200;
                        imageCanvas.height = totalHeight;

                        // Fill background
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, imageCanvas.width, imageCanvas.height);

                        // Draw header
                        ctx.fillStyle = '#1976d2';
                        ctx.fillRect(0, 0, imageCanvas.width, headerHeight);

                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 28px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(`${eventName} - ${eventDateFormatted}`, imageCanvas.width / 2, headerHeight / 2 - 12);

                        if (diagram.description) {
                            ctx.font = '20px sans-serif';
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                            ctx.fillText(diagram.description, imageCanvas.width / 2, headerHeight / 2 + 18);
                        }

                        let yOffset = headerHeight + padding;
                        
                        // Draw dance name
                        ctx.fillStyle = '#333';
                        ctx.font = 'bold 22px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(diagram.danceName, imageCanvas.width / 2, yOffset + 18);
                        yOffset += 35;

                        // Draw the diagram canvas
                        ctx.drawImage(canvas, 0, yOffset);

                        if (backupText) {
                            const backupY = yOffset + canvas.height + 28;
                            ctx.fillStyle = '#333';
                            ctx.font = '18px sans-serif';
                            ctx.textAlign = 'left';
                            ctx.fillText(backupText, 30, backupY);
                        }

                        // Draw legend centered at the bottom if more than one position type
                        if (showLegend && legendItems.length > 0) {
                            const boxSize = 14;
                            const boxMargin = 6;
                            const itemGap = 30;
                            const legendBottomPadding = 10;
                            
                            // Measure text widths to calculate proper spacing
                            ctx.font = '13px sans-serif';
                            const itemWidths = legendItems.map(function (item) {
                                const textMetrics = ctx.measureText(item.label);
                                return boxSize + boxMargin + textMetrics.width;
                            });
                            
                            // Determine how many items per row
                            const availableWidth = imageCanvas.width - 60;
                            let currentRow = [];
                            let rows = [];
                            let currentRowWidth = 0;
                            
                            itemWidths.forEach(function (width, idx) {
                                const itemWithGap = currentRow.length === 0 ? width : width + itemGap;
                                if (currentRowWidth + itemWithGap > availableWidth && currentRow.length > 0) {
                                    rows.push(currentRow);
                                    currentRow = [idx];
                                    currentRowWidth = width;
                                } else {
                                    currentRow.push(idx);
                                    currentRowWidth += itemWithGap;
                                }
                            });
                            if (currentRow.length > 0) {
                                rows.push(currentRow);
                            }
                            
                            // Draw legend rows
                            const legendY = imageCanvas.height - legendHeight + legendBottomPadding;
                            rows.forEach(function (row, rowIdx) {
                                // Calculate row width and center it
                                let rowWidth = 0;
                                row.forEach(function (idx, i) {
                                    rowWidth += itemWidths[idx];
                                    if (i < row.length - 1) {
                                        rowWidth += itemGap;
                                    }
                                });
                                
                                const startX = (imageCanvas.width - rowWidth) / 2;
                                let currentX = startX;
                                
                                // Draw items in this row
                                row.forEach(function (itemIdx) {
                                    const item = legendItems[itemIdx];
                                    const currentY = legendY + (rowIdx * 22);
                                    
                                    // Draw color box
                                    ctx.fillStyle = item.color;
                                    ctx.fillRect(currentX, currentY + 2, boxSize, boxSize);
                                    ctx.strokeStyle = '#fff';
                                    ctx.lineWidth = 1.5;
                                    ctx.strokeRect(currentX, currentY + 2, boxSize, boxSize);
                                    
                                    // Draw label
                                    ctx.fillStyle = '#333';
                                    ctx.font = '13px sans-serif';
                                    ctx.textAlign = 'left';
                                    ctx.fillText(item.label, currentX + boxSize + boxMargin, currentY + 12);
                                    
                                    currentX += itemWidths[itemIdx] + itemGap;
                                });
                            });
                        }

                        // Convert to blob and create file
                        imageCanvas.toBlob(function (blob) {
                            const fileName = eventName + ' - ' + diagram.danceName + '.png';
                            const file = new File([blob], fileName, { type: 'image/png' });
                            files.push(file);
                        }, 'image/png');
                    });

                    // Wait for all files to be created
                    const maxWait = 5000;
                    const startTime = Date.now();
                    while (files.length < diagrams.length && Date.now() - startTime < maxWait) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    // Share files using Web Share API, fall back to download
                    if (navigator.share && navigator.canShare && files.length > 0 && navigator.canShare({ files: files })) {
                        await navigator.share({
                            files: files,
                            title: eventName,
                            text: `${eventName}\n ${eventDateFormatted}`,
                        });
                        floatingShareBtn.classList.add('success');
                        setTimeout(function () {
                            floatingShareBtn.classList.remove('success');
                        }, 2000);
                    } else if (files.length > 0) {
                        // Fallback: download each image
                        files.forEach(function (file) {
                            const url = URL.createObjectURL(file);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = file.name;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        });

                        floatingShareBtn.classList.add('success');
                        setTimeout(function () {
                            floatingShareBtn.classList.remove('success');
                        }, 2000);
                    }
                } catch (error) {
                    console.error('Error sharing event:', error);
                    alert('Error compartint l\'actuació: ' + (error.message || error));
                } finally {
                    floatingShareBtn.disabled = false;
                }
            });

            // Floating lock button long-press functionality
            const floatingLockBtn = document.getElementById('floating-lock-btn');
            let lockBtnPressTimer = null;
            let lockBtnPressed = false;

            function resetLockBtnProgress() {
                floatingLockBtn.classList.remove('pressing');
                const progressRing = floatingLockBtn.querySelector('.progress-ring');
                progressRing.style.strokeDashoffset = '138.23';
                lockBtnPressed = false;
            }

            floatingLockBtn.addEventListener('mousedown', function () {
                if (isEventEditable) return; // Only work when event is locked
                const isAdmin = APP.currentUser && APP.currentUser.roles && APP.currentUser.roles.includes('ADMIN');
                if (!isAdmin) return; // Only admin can unlock

                lockBtnPressed = true;
                floatingLockBtn.classList.add('pressing');
                let pressedTime = 0;
                const pressDuration = 3000; // 3 seconds
                const maxDashOffset = 138.23;
                const progressRing = floatingLockBtn.querySelector('.progress-ring');

                lockBtnPressTimer = setInterval(function () {
                    if (!lockBtnPressed) {
                        clearInterval(lockBtnPressTimer);
                        resetLockBtnProgress();
                        return;
                    }

                    pressedTime += 50;
                    const progress = Math.min(pressedTime / pressDuration, 1);
                    const dashOffset = maxDashOffset * (1 - progress);
                    progressRing.style.strokeDashoffset = dashOffset;

                    if (pressedTime >= pressDuration) {
                        clearInterval(lockBtnPressTimer);
                        floatingLockBtn.classList.remove('pressing');
                        
                        // Make event editable again
                        isEventManuallyUnlocked = true;
                        isEventEditable = true;
                        applyEditableState();
                        
                        // Show success feedback
                        floatingLockBtn.style.background = '#43a047';
                        setTimeout(function () {
                            floatingLockBtn.style.background = '#757575';
                            resetLockBtnProgress();
                        }, 1000);
                    }
                }, 50);
            });

            floatingLockBtn.addEventListener('mouseup', function () {
                if (lockBtnPressTimer) {
                    clearInterval(lockBtnPressTimer);
                    resetLockBtnProgress();
                }
            });

            floatingLockBtn.addEventListener('mouseleave', function () {
                if (lockBtnPressTimer) {
                    clearInterval(lockBtnPressTimer);
                    resetLockBtnProgress();
                }
            });

            // Touch events for mobile devices
            floatingLockBtn.addEventListener('touchstart', function () {
                if (isEventEditable) return; // Only work when event is locked
                const isAdmin = APP.currentUser && APP.currentUser.roles && APP.currentUser.roles.includes('ADMIN');
                if (!isAdmin) return; // Only admin can unlock

                lockBtnPressed = true;
                floatingLockBtn.classList.add('pressing');
                let pressedTime = 0;
                const pressDuration = 3000; // 3 seconds
                const maxDashOffset = 138.23;
                const progressRing = floatingLockBtn.querySelector('.progress-ring');

                lockBtnPressTimer = setInterval(function () {
                    if (!lockBtnPressed) {
                        clearInterval(lockBtnPressTimer);
                        resetLockBtnProgress();
                        return;
                    }

                    pressedTime += 50;
                    const progress = Math.min(pressedTime / pressDuration, 1);
                    const dashOffset = maxDashOffset * (1 - progress);
                    progressRing.style.strokeDashoffset = dashOffset;

                    if (pressedTime >= pressDuration) {
                        clearInterval(lockBtnPressTimer);
                        floatingLockBtn.classList.remove('pressing');
                        
                        // Make event editable again
                        isEventManuallyUnlocked = true;
                        isEventEditable = true;
                        applyEditableState();
                        
                        // Show success feedback
                        floatingLockBtn.style.background = '#43a047';
                        setTimeout(function () {
                            floatingLockBtn.style.background = '#757575';
                            resetLockBtnProgress();
                        }, 1000);
                    }
                }, 50);
            });

            floatingLockBtn.addEventListener('touchend', function () {
                if (lockBtnPressTimer) {
                    clearInterval(lockBtnPressTimer);
                    resetLockBtnProgress();
                }
            });

            floatingLockBtn.addEventListener('touchcancel', function () {
                if (lockBtnPressTimer) {
                    clearInterval(lockBtnPressTimer);
                    resetLockBtnProgress();
                }
            });

            // Floating lock button long-press functionality for TRAINING
            const floatingLockTrainingBtn = document.getElementById('floating-lock-training-btn');
            let lockTrainingBtnPressTimer = null;
            let lockTrainingBtnPressed = false;

            function resetLockTrainingBtnProgress() {
                floatingLockTrainingBtn.classList.remove('pressing');
                const progressRing = floatingLockTrainingBtn.querySelector('.progress-ring');
                if (progressRing) {
                    progressRing.style.strokeDashoffset = '138.23';
                }
                lockTrainingBtnPressed = false;
            }

            floatingLockTrainingBtn.addEventListener('mousedown', function () {
                if (isTrainingEditable) return; // Only work when training is locked
                const isAdmin = APP.currentUser && APP.currentUser.roles && APP.currentUser.roles.includes('ADMIN');
                if (!isAdmin) return; // Only admin can unlock

                lockTrainingBtnPressed = true;
                floatingLockTrainingBtn.classList.add('pressing');
                let pressedTime = 0;
                const pressDuration = 3000; // 3 seconds
                const maxDashOffset = 138.23;
                const progressRing = floatingLockTrainingBtn.querySelector('.progress-ring');

                lockTrainingBtnPressTimer = setInterval(function () {
                    if (!lockTrainingBtnPressed) {
                        clearInterval(lockTrainingBtnPressTimer);
                        resetLockTrainingBtnProgress();
                        return;
                    }

                    pressedTime += 50;
                    const progress = Math.min(pressedTime / pressDuration, 1);
                    const dashOffset = maxDashOffset * (1 - progress);
                    progressRing.style.strokeDashoffset = dashOffset;

                    if (pressedTime >= pressDuration) {
                        clearInterval(lockTrainingBtnPressTimer);
                        floatingLockTrainingBtn.classList.remove('pressing');
                        
                        // Make training editable again
                        isTrainingManuallyUnlocked = true;
                        isTrainingEditable = true;
                        TRAININGS.applyTrainingEditableState();
                        
                        // Show success feedback
                        floatingLockTrainingBtn.style.background = '#43a047';
                        setTimeout(function () {
                            floatingLockTrainingBtn.style.background = '#757575';
                            resetLockTrainingBtnProgress();
                        }, 1000);
                    }
                }, 50);
            });

            floatingLockTrainingBtn.addEventListener('mouseup', function () {
                if (lockTrainingBtnPressTimer) {
                    clearInterval(lockTrainingBtnPressTimer);
                    resetLockTrainingBtnProgress();
                }
            });

            floatingLockTrainingBtn.addEventListener('mouseleave', function () {
                if (lockTrainingBtnPressTimer) {
                    clearInterval(lockTrainingBtnPressTimer);
                    resetLockTrainingBtnProgress();
                }
            });

            // Touch events for mobile devices
            floatingLockTrainingBtn.addEventListener('touchstart', function () {
                if (isTrainingEditable) return; // Only work when training is locked
                const isAdmin = APP.currentUser && APP.currentUser.roles && APP.currentUser.roles.includes('ADMIN');
                if (!isAdmin) return; // Only admin can unlock

                lockTrainingBtnPressed = true;
                floatingLockTrainingBtn.classList.add('pressing');
                let pressedTime = 0;
                const pressDuration = 3000; // 3 seconds
                const maxDashOffset = 138.23;
                const progressRing = floatingLockTrainingBtn.querySelector('.progress-ring');

                lockTrainingBtnPressTimer = setInterval(function () {
                    if (!lockTrainingBtnPressed) {
                        clearInterval(lockTrainingBtnPressTimer);
                        resetLockTrainingBtnProgress();
                        return;
                    }

                    pressedTime += 50;
                    const progress = Math.min(pressedTime / pressDuration, 1);
                    const dashOffset = maxDashOffset * (1 - progress);
                    progressRing.style.strokeDashoffset = dashOffset;

                    if (pressedTime >= pressDuration) {
                        clearInterval(lockTrainingBtnPressTimer);
                        floatingLockTrainingBtn.classList.remove('pressing');
                        
                        // Make training editable again
                        isTrainingManuallyUnlocked = true;
                        isTrainingEditable = true;
                        TRAININGS.applyTrainingEditableState();
                        
                        // Show success feedback
                        floatingLockTrainingBtn.style.background = '#43a047';
                        setTimeout(function () {
                            floatingLockTrainingBtn.style.background = '#757575';
                            resetLockTrainingBtnProgress();
                        }, 1000);
                    }
                }, 50);
            });

            floatingLockTrainingBtn.addEventListener('touchend', function () {
                if (lockTrainingBtnPressTimer) {
                    clearInterval(lockTrainingBtnPressTimer);
                    resetLockTrainingBtnProgress();
                }
            });

            floatingLockTrainingBtn.addEventListener('touchcancel', function () {
                if (lockTrainingBtnPressTimer) {
                    clearInterval(lockTrainingBtnPressTimer);
                    resetLockTrainingBtnProgress();
                }
            });
        });
    

// === SCRIPT 2 FROM main.njk ===

        (function () {
            const nameFilterToggle = document.getElementById('name-filter-toggle');
            const emailFilterToggle = document.getElementById('email-filter-toggle');
            const typeFilterToggle = document.getElementById('type-filter-toggle');
            const typeFilterDropdown = document.getElementById('type-filter-dropdown');
            const rolsFilterToggle = document.getElementById('rols-filter-toggle');
            const rolsFilterDropdown = document.getElementById('rols-filter-dropdown');
            const accessFilterToggle = document.getElementById('access-filter-toggle');
            const accessFilterDropdown = document.getElementById('access-filter-dropdown');
            const activeFilterToggle = document.getElementById('active-filter-toggle');
            const activeFilterDropdown = document.getElementById('active-filter-dropdown');
            const membersFilter = document.getElementById('members-filter');
            const searchInput = document.getElementById('members-search');
            const filterSummary = document.getElementById('members-filter-summary');
            const filterSummaryText = document.getElementById('filter-summary-text');
            const clearAllFiltersLink = document.getElementById('clear-all-filters');

            // Update filter summary based on active filters
            function updateFilterSummary() {
                const parts = [];

                // Check search filter
                const searchValue = searchInput ? searchInput.value.trim() : '';
                if (searchValue) {
                    parts.push('cerca "' + searchValue + '"');
                }

                // Check type filter
                if (typeof MEMBERS !== 'undefined' && MEMBERS.membersTypeFilterValue) {
                    const typeLabel = MEMBERS.membersTypeFilterValue === 'ADULT' ? 'Adults' : 'Xiquets/es';
                    parts.push(typeLabel);
                }

                // Check rols filter
                if (typeof MEMBERS !== 'undefined' && MEMBERS.membersRolsFilterValue) {
                    const rolLabel = MEMBERS.membersRolsFilterValue === 'ADMIN' ? 'amb ADMIN' : 'sense ADMIN';
                    parts.push(rolLabel);
                }

                // Check access filter
                if (typeof MEMBERS !== 'undefined' && MEMBERS.membersAccessFilterValue) {
                    const accessLabel = MEMBERS.membersAccessFilterValue === 'HAS_ACCESS' ? 'amb accés a altres' : 'sense accés a altres';
                    parts.push(accessLabel);
                }

                // Check active filter
                if (typeof MEMBERS !== 'undefined' && MEMBERS.membersActiveFilterValue) {
                    const activeLabel = MEMBERS.membersActiveFilterValue === 'true' ? 'actius' : 'inactius';
                    parts.push(activeLabel);
                }

                if (parts.length > 0 && filterSummary && filterSummaryText) {
                    filterSummaryText.textContent = 'Mostrant: ' + parts.join(', ');
                    filterSummary.style.display = 'flex';
                } else if (filterSummary) {
                    filterSummary.style.display = 'none';
                }
            }

            // Clear all filters
            function clearAllFilters(e) {
                if (e) e.preventDefault();

                // Clear search
                if (searchInput) {
                    searchInput.value = '';
                }
                membersFilter.style.display = 'none';
                [nameFilterToggle, emailFilterToggle].forEach(function (el) {
                    if (el) el.classList.remove('active');
                });

                // Clear type filter
                if (typeof MEMBERS !== 'undefined') {
                    MEMBERS.membersTypeFilterValue = '';
                }
                if (typeFilterDropdown) {
                    const options = typeFilterDropdown.querySelectorAll('.type-filter-option');
                    options.forEach(function (opt, i) {
                        opt.classList.toggle('selected', i === 0);
                    });
                }
                if (typeFilterToggle) typeFilterToggle.classList.remove('active');

                // Clear rols filter
                if (typeof MEMBERS !== 'undefined') {
                    MEMBERS.membersRolsFilterValue = '';
                }
                if (rolsFilterDropdown) {
                    const options = rolsFilterDropdown.querySelectorAll('.type-filter-option');
                    options.forEach(function (opt, i) {
                        opt.classList.toggle('selected', i === 0);
                    });
                }
                if (rolsFilterToggle) rolsFilterToggle.classList.remove('active');

                // Clear access filter
                if (typeof MEMBERS !== 'undefined') {
                    MEMBERS.membersAccessFilterValue = '';
                }
                if (accessFilterDropdown) {
                    const options = accessFilterDropdown.querySelectorAll('.type-filter-option');
                    options.forEach(function (opt, i) {
                        opt.classList.toggle('selected', i === 0);
                    });
                }
                if (accessFilterToggle) accessFilterToggle.classList.remove('active');

                // Clear active filter
                if (typeof MEMBERS !== 'undefined') {
                    MEMBERS.membersActiveFilterValue = '';
                }
                if (activeFilterDropdown) {
                    const options = activeFilterDropdown.querySelectorAll('.type-filter-option');
                    options.forEach(function (opt, i) {
                        opt.classList.toggle('selected', i === 0);
                    });
                }
                if (activeFilterToggle) activeFilterToggle.classList.remove('active');

                // Re-render and update summary
                if (typeof MEMBERS !== 'undefined' && typeof MEMBERS._renderMembersTable === 'function') {
                    MEMBERS._renderMembersTable();
                }
                updateFilterSummary();
            }

            // Attach clear all filters handler
            if (clearAllFiltersLink) {
                clearAllFiltersLink.addEventListener('click', clearAllFilters);
            }

            // Update filter summary when search input changes
            if (searchInput) {
                searchInput.addEventListener('input', function () {
                    updateFilterSummary();
                });
            }

            // Make updateFilterSummary available globally
            window.updateMembersFilterSummary = updateFilterSummary;

            function toggleTextFilter(toggleElement) {
                if (!membersFilter) return;
                const isVisible = membersFilter.style.display !== 'none';
                membersFilter.style.display = isVisible ? 'none' : 'block';

                // Update active state for text filter toggles
                [nameFilterToggle, emailFilterToggle].forEach(function (el) {
                    if (el) el.classList.toggle('active', !isVisible);
                });

                if (!isVisible && searchInput) {
                    searchInput.focus();
                }
            }

            function toggleTypeDropdown(e) {
                if (!typeFilterDropdown) return;
                if (rolsFilterDropdown) rolsFilterDropdown.style.display = 'none';
                if (accessFilterDropdown) accessFilterDropdown.style.display = 'none';
                if (activeFilterDropdown) activeFilterDropdown.style.display = 'none';
                const isVisible = typeFilterDropdown.style.display !== 'none';
                typeFilterDropdown.style.display = isVisible ? 'none' : 'block';
            }

            function toggleRolsDropdown(e) {
                if (!rolsFilterDropdown) return;
                if (typeFilterDropdown) typeFilterDropdown.style.display = 'none';
                if (accessFilterDropdown) accessFilterDropdown.style.display = 'none';
                if (activeFilterDropdown) activeFilterDropdown.style.display = 'none';
                const isVisible = rolsFilterDropdown.style.display !== 'none';
                rolsFilterDropdown.style.display = isVisible ? 'none' : 'block';
            }

            function toggleAccessDropdown(e) {
                if (!accessFilterDropdown) return;
                if (typeFilterDropdown) typeFilterDropdown.style.display = 'none';
                if (rolsFilterDropdown) rolsFilterDropdown.style.display = 'none';
                if (activeFilterDropdown) activeFilterDropdown.style.display = 'none';
                const isVisible = accessFilterDropdown.style.display !== 'none';
                accessFilterDropdown.style.display = isVisible ? 'none' : 'block';
            }

            function toggleActiveDropdown(e) {
                if (!activeFilterDropdown) return;
                if (typeFilterDropdown) typeFilterDropdown.style.display = 'none';
                if (rolsFilterDropdown) rolsFilterDropdown.style.display = 'none';
                if (accessFilterDropdown) accessFilterDropdown.style.display = 'none';
                const isVisible = activeFilterDropdown.style.display !== 'none';
                activeFilterDropdown.style.display = isVisible ? 'none' : 'block';
            }

            // Close dropdown when clicking outside
            document.addEventListener('click', function (e) {
                if (typeFilterDropdown && !typeFilterToggle.contains(e.target) && !typeFilterDropdown.contains(e.target)) {
                    typeFilterDropdown.style.display = 'none';
                }
                if (rolsFilterDropdown && !rolsFilterToggle.contains(e.target) && !rolsFilterDropdown.contains(e.target)) {
                    rolsFilterDropdown.style.display = 'none';
                }
                if (accessFilterDropdown && !accessFilterToggle.contains(e.target) && !accessFilterDropdown.contains(e.target)) {
                    accessFilterDropdown.style.display = 'none';
                }
                if (activeFilterDropdown && !activeFilterToggle.contains(e.target) && !activeFilterDropdown.contains(e.target)) {
                    activeFilterDropdown.style.display = 'none';
                }
            });

            // Handle type filter selection
            if (typeFilterDropdown) {
                const options = typeFilterDropdown.querySelectorAll('.type-filter-option');
                options.forEach(function (option) {
                    option.addEventListener('click', function (e) {
                        e.stopPropagation();
                        const selectedValue = this.getAttribute('data-value');

                        // Update selected state
                        options.forEach(function (opt) {
                            opt.classList.remove('selected');
                        });
                        this.classList.add('selected');

                        // Set filter value and re-render
                        if (typeof MEMBERS !== 'undefined') {
                            MEMBERS.membersTypeFilterValue = selectedValue;
                            MEMBERS._renderMembersTable();
                        }

                        // Update active state for type filter
                        typeFilterToggle.classList.toggle('active', selectedValue !== '');
                        typeFilterDropdown.style.display = 'none';
                        updateFilterSummary();
                    });
                });

                // Set initial selected state
                options[0].classList.add('selected');
            }

            // Handle rols filter selection
            if (rolsFilterDropdown) {
                const options = rolsFilterDropdown.querySelectorAll('.type-filter-option');
                options.forEach(function (option) {
                    option.addEventListener('click', function (e) {
                        e.stopPropagation();
                        const selectedValue = this.getAttribute('data-value');

                        // Update selected state
                        options.forEach(function (opt) {
                            opt.classList.remove('selected');
                        });
                        this.classList.add('selected');

                        // Set filter value and re-render
                        if (typeof MEMBERS !== 'undefined') {
                            MEMBERS.membersRolsFilterValue = selectedValue;
                            MEMBERS._renderMembersTable();
                        }

                        // Update active state for rols filter
                        rolsFilterToggle.classList.toggle('active', selectedValue !== '');
                        rolsFilterDropdown.style.display = 'none';
                        updateFilterSummary();
                    });
                });

                // Set initial selected state
                options[0].classList.add('selected');
            }

            // Handle access filter selection
            if (accessFilterDropdown) {
                const options = accessFilterDropdown.querySelectorAll('.type-filter-option');
                options.forEach(function (option) {
                    option.addEventListener('click', function (e) {
                        e.stopPropagation();
                        const selectedValue = this.getAttribute('data-value');

                        // Update selected state
                        options.forEach(function (opt) {
                            opt.classList.remove('selected');
                        });
                        this.classList.add('selected');

                        // Set filter value and re-render
                        if (typeof MEMBERS !== 'undefined') {
                            MEMBERS.membersAccessFilterValue = selectedValue;
                            MEMBERS._renderMembersTable();
                        }

                        // Update active state for access filter
                        accessFilterToggle.classList.toggle('active', selectedValue !== '');
                        accessFilterDropdown.style.display = 'none';
                        updateFilterSummary();
                    });
                });

                // Set initial selected state
                options[0].classList.add('selected');
            }

            // Handle active filter selection
            if (activeFilterDropdown) {
                const options = activeFilterDropdown.querySelectorAll('.type-filter-option');
                options.forEach(function (option) {
                    option.addEventListener('click', function (e) {
                        e.stopPropagation();
                        const selectedValue = this.getAttribute('data-value');

                        // Update selected state
                        options.forEach(function (opt) {
                            opt.classList.remove('selected');
                        });
                        this.classList.add('selected');

                        // Set filter value and re-render
                        if (typeof MEMBERS !== 'undefined') {
                            MEMBERS.membersActiveFilterValue = selectedValue;
                            MEMBERS._renderMembersTable();
                        }

                        // Update active state for active filter
                        activeFilterToggle.classList.toggle('active', selectedValue !== '');
                        activeFilterDropdown.style.display = 'none';
                        updateFilterSummary();
                    });
                });

                // Set initial selected state
                options[0].classList.add('selected');
            }

            if (nameFilterToggle) {
                nameFilterToggle.addEventListener('click', function (e) {
                    e.stopPropagation();
                    toggleTextFilter(this);
                });
            }

            if (emailFilterToggle) {
                emailFilterToggle.addEventListener('click', function (e) {
                    e.stopPropagation();
                    toggleTextFilter(this);
                });
            }

            if (typeFilterToggle) {
                typeFilterToggle.addEventListener('click', function (e) {
                    e.stopPropagation();
                    toggleTypeDropdown(e);
                });
            }

            if (rolsFilterToggle) {
                rolsFilterToggle.addEventListener('click', function (e) {
                    e.stopPropagation();
                    toggleRolsDropdown(e);
                });
            }

            if (accessFilterToggle) {
                accessFilterToggle.addEventListener('click', function (e) {
                    e.stopPropagation();
                    toggleAccessDropdown(e);
                });
            }

            if (activeFilterToggle) {
                activeFilterToggle.addEventListener('click', function (e) {
                    e.stopPropagation();
                    toggleActiveDropdown(e);
                });
            }

            // Global edit button - calls startEditAllMembers from MEMBERS
            const editAllBtn = document.getElementById('edit-all-members-btn');
            if (editAllBtn) {
                editAllBtn.addEventListener('click', function () {
                    if (typeof MEMBERS !== 'undefined' && typeof MEMBERS.startEditAllMembers === 'function') {
                        MEMBERS.startEditAllMembers();
                    }
                });
            }
        })();
    
