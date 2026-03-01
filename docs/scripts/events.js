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
      
      const refreshBtn = document.getElementById("refresh-event-btn");
      if (refreshBtn) {
        refreshBtn.style.display = "block";
      }
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
    const isAdmin = APP.currentUser && (APP.currentUser.roles || []).includes("ADMIN");
    const showEvent = event.visible || isAdmin;
    if(showEvent) {
      const formattedDate = formatEventDate(event.date);
      let meetingPlaceHtml = "";
      if (event.meetingPlace) {
        if (event.placeUrl) {
          meetingPlaceHtml = `<a href="${escapeHtml(event.placeUrl)}" target="_blank" class="event-card-place">📍 ${escapeHtml(event.meetingPlace)} 🗺️</a>`;
        } else {
          meetingPlaceHtml = `<span class="event-card-place">📍 ${escapeHtml(event.meetingPlace)}</span>`;
        }
      }
      const tbcHtml = !(event.confirmed || isAdmin)
        ? `<span class="event-tbc" style="font-style: italic; color: var(--text-secondary, #666);">TBC</span>`
        : '';

      // Generate confirmation status for current user
      let confirmationStatusHtml = "";
      const now = new Date();
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
          let button2Html = '';

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
              `confirmEventRelatedMemberAttendance('${escapeHtml(event.id)}', '${escapeHtml(memberAlias)}')` :
              `confirmEventAttendance('${escapeHtml(event.id)}')`;
            const rejectFn = isRelatedMember ?
              `rejectEventRelatedMemberAttendance('${escapeHtml(event.id)}', '${escapeHtml(memberAlias)}')` :
              `rejectEventAttendance('${escapeHtml(event.id)}')`;
            const resetFn = isRelatedMember ?
              `resetEventRelatedMemberAttendance('${escapeHtml(event.id)}', '${escapeHtml(memberAlias)}')` :
              `resetEventAttendance('${escapeHtml(event.id)}')`;

            const noAttendingText = isRelatedMember ? 'No assistirà' : 'No assistiré';
            const noAttendingTitle = isRelatedMember ? 'No assistirà' : 'No assistiré';

            if (isConfirmed) {
              statusClass = 'event-status-indicator confirmed';
              statusText = '✔ Confirmat';
              button1Html = `<button type="button" class="btn btn-xs btn-outline-secondary" onclick="${resetFn}" title="Restablir a no confirmat">↩ Restablir</button>`;
              button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="${rejectFn}" title="${noAttendingTitle}">✕ ${noAttendingText}</button>`;
            } else if (isRejected) {
              statusClass = 'event-status-indicator not-attending';
              statusText = `✕ ${noAttendingText}`;
              button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="${confirmFn}" title="Confirmar assistència">✔ Confirmar</button>`;
              button2Html = `<button type="button" class="btn btn-xs btn-outline-secondary" onclick="${resetFn}" title="Restablir a no confirmat">↩ Restablir</button>`;
            } else {
              button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="${confirmFn}" title="Confirmar assistència">✔ Confirmar</button>`;
              button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="${rejectFn}" title="${noAttendingTitle}">✕ ${noAttendingText}</button>`;
            }
          }

          const sectionClass = isRelatedMember ? 'event-confirmation-section related-member' : 'event-confirmation-section';
          const nameHtml = showName ? `<span class="event-confirmation-member-name">${escapeHtml(memberName)}</span>` : '';
          const buttonsHtml = isPastEvent ? '' : `<div class="event-confirmation-buttons">${button1Html}${button2Html}</div>`;

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

      return `
      <div class="event-card" data-event-id="${event.id}" onclick="viewEvent('${escapeHtml(event.id)}')">
      <div class="event-card-info">
      <span class="event-card-name">${event.name}</span>
      <span class="event-card-date">${formattedDate}</span>
      ${meetingPlaceHtml}
      ${tbcHtml}
      ${confirmationStatusHtml}
      </div>
      </div>
      `;
    }
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
        content.style.display = "";
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
  if (APP.currentEventId === eventId) {
    return;
  }
  
  APP.currentEventId = eventId;
  
  APP.showLoading(true);

  API.getEventById({ eventId })
    .then(function (eventData) {
      APP.showLoading(false);

      if (!eventData) {
        showToast("No s'ha trobat l'esdeveniment", "error");
        return;
      }
      // Store event data globally
      APP.currentEventData = eventData;
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

      // Prepare event attendance section for admin
      prepareEventAttendanceSection();
      initializeEventAttendanceToggle();

      // Load diagrams after a short delay to ensure dances data is loaded
      setTimeout(function () {
        loadEventDiagrams(eventData);
      }, 500);

      showToast("Esdeveniment carregat", "success");
    })
    .catch(function (error) {
      APP.showLoading(false);
      console.error("Error loading event:", error);
      showToast("Error carregant l'esdeveniment", "error");
    });
}

/**
 * Quick navigate to event (backward compatibility)
 */
function viewEvent(eventId) {
  if (!eventId) return;
  APP.eventIdToLoad = escapeHtml(eventId);
  window.location.hash = "events/" + encodeURIComponent(eventId);
}


/**
 * Render diagrams once dances data is available
 * Used by loadEventDiagrams after dances are loaded
 */
function renderDiagrams(eventData) {
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

  eventData.diagrams.forEach(function (diagramData) {
    // Find the dance info to get colors and other metadata
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

/**
 * Load diagrams from event data into the events view
 * @param {Object} eventData - The event data with diagrams
 */
function loadEventDiagrams(eventData) {
  if (!eventData || !eventData.diagrams) return;

  const diagramsList = document.getElementById("diagrams-list");
  if (!diagramsList) return;

  // Clear existing diagrams
  diagramsList.innerHTML = "";

  // Reset diagrams array (this is defined in events.html)
  if (typeof diagrams !== "undefined") {
    diagrams.length = 0;
    diagramIdCounter = 0;
  }

  renderDiagrams(eventData);
}

/**
 * Setup canvas click handler for a loaded diagram
 * This wraps the internal setupCanvasClickHandler from events.html
 * @param {number} diagramId - The diagram ID
 */
function setupCanvasClickHandlerForDiagram(diagramId) {
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

  // Check if event is in the past - if so, include inactive members
  let isEventInPast = false;
  if (eventDatetimeInput && eventDatetimeInput.value) {
    const eventDate = new Date(eventDatetimeInput.value);
    const now = new Date();
    isEventInPast = eventDate < now;
  }

  // Filter members: only active for future events, all for past events
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
    showDialogWithBackdrop(dialog);
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
 * Prepare the event attendance section (show/hide based on admin role)
 */
function prepareEventAttendanceSection() {
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
  } else {
    attendanceSection.style.display = "none";
  }
}

/**
 * Initialize event attendance section toggle
 */
function initializeEventAttendanceToggle() {
  const attendanceToggle = document.getElementById("event-attendance-toggle");
  
  if (attendanceToggle && !attendanceToggle.dataset.initialized) {
    attendanceToggle.addEventListener("click", function () {
      const attendanceList = document.getElementById("event-member-attendance-list");
      const toggleArrow = attendanceToggle.querySelector(".toggle-arrow");
      
      if (attendanceList) {
        const isCollapsed = attendanceList.classList.contains("collapsed");
        
        if (isCollapsed) {
          loadEventMembersAttendance(APP.currentEventData);
        }
        
        attendanceList.classList.toggle("collapsed");
        toggleArrow.textContent = attendanceList.classList.contains("collapsed") ? "▶" : "▼";
        attendanceToggle.setAttribute("aria-expanded", !attendanceList.classList.contains("collapsed"));
      }
    });
    attendanceToggle.dataset.initialized = "true";
  }
}

/**
 * Load members and display attendance list for event (admin only)
 * @param {Object} eventData - Event data object with attendance and rejections
 */
function loadEventMembersAttendance(eventData) {
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
        displayEventMemberAttendanceList(eventData);
      }
    })
    .catch(function (error) {
      console.error("Error loading members for event:", error);
      attendanceList.innerHTML = '<div class="event-member-attendance-loading">Error al carregar membres</div>';
    });
}

/**
 * Display member attendance list for event (admin only)
 * @param {Object} eventData - Event data object with attendance and rejections
 */
function displayEventMemberAttendanceList(eventData) {
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
    const disabledAttr = isPastEvent ? 'disabled' : '';
    const disabledClass = isPastEvent ? ' disabled' : '';
    
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
  
  // Update attendance count
  const countSpan = document.getElementById("event-attendance-count");
  if (countSpan) {
    const attendCount = attendeesList.length;
    const rejectCount = rejectionsList.length;
    countSpan.textContent = `${attendCount} SI / ${rejectCount} NO`;
  }
  
  if (!isPastEvent) {
    attendanceList.querySelectorAll('.event-member-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', handleMemberEventAttendanceChange);
    });
  }
  
  attendanceList.scrollTop = 0;
}

/**
 * Handle checkbox change for member event attendance
 * @param {Event} event - The change event
 */
function handleMemberEventAttendanceChange(event) {
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
        if (attending) {
          if (!attendeesList.includes(memberAlias)) {
            attendeesList.push(memberAlias);
          }
        } else {
          const index = attendeesList.indexOf(memberAlias);
          if (index > -1) {
            attendeesList.splice(index, 1);
          }
        }
        APP.currentEventData.attendees = attendeesList;
        
        // Update the attendance count
        const countSpan = document.getElementById("event-attendance-count");
        if (countSpan) {
          const attendCount = attendeesList.length;
          const rejectCount = (APP.currentEventData.rejections || []).length;
          countSpan.textContent = `${attendCount} SI / ${rejectCount} NO`;
        }
      }
    })
    .catch(function(error) {
      console.error('Error updating attendance:', error);
      showToast(error || 'Error actualitzant assistència', 'error');
      checkbox.checked = !attending;
    })
    .finally(function() {
      checkbox.disabled = false;
      customCheckbox.classList.remove('loading');
    });
}


/**
 * Confirm event attendance for current user
 */
function confirmEventAttendance(eventId) {
  if (!APP.currentUser) {
    showToast('Si us plau, inicia sessió', 'warning');
    return;
  }

  updateEventAttendance(eventId, APP.currentUser.alias, true);
}

/**
 * Reject event attendance for current user
 */
function rejectEventAttendance(eventId) {
  if (!APP.currentUser) {
    showToast('Si us plau, inicia sessió', 'warning');
    return;
  }

  updateEventAttendance(eventId, APP.currentUser.alias, false);
}

/**
 * Reset event attendance for current user to not-confirmed
 */
function resetEventAttendance(eventId) {
  if (!APP.currentUser) {
    showToast('Si us plau, inicia sessió', 'warning');
    return;
  }

  updateEventAttendance(eventId, APP.currentUser.alias, null);
}

/**
 * Confirm event attendance for related member
 */
function confirmEventRelatedMemberAttendance(eventId, memberAlias) {
  updateEventAttendance(eventId, memberAlias, true);
}

/**
 * Reject event attendance for related member
 */
function rejectEventRelatedMemberAttendance(eventId, memberAlias) {
  updateEventAttendance(eventId, memberAlias, false);
}

/**
 * Reset event attendance for related member to not-confirmed
 */
function resetEventRelatedMemberAttendance(eventId, memberAlias) {
  updateEventAttendance(eventId, memberAlias, null);
}

/**
 * Update event attendance status via API
 */
function updateEventAttendance(eventId, memberAlias, attending) {
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
      // Update the status indicator
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
      
      // Update the buttons based on new status
      if (buttonsContainer) {
        const isRelatedMember = section.classList.contains('related-member');
        const confirmFn = isRelatedMember ?
          `confirmEventRelatedMemberAttendance('${escapeHtml(eventId)}', '${escapeHtml(memberAlias)}')` :
          `confirmEventAttendance('${escapeHtml(eventId)}')`;
        const rejectFn = isRelatedMember ?
          `rejectEventRelatedMemberAttendance('${escapeHtml(eventId)}', '${escapeHtml(memberAlias)}')` :
          `rejectEventAttendance('${escapeHtml(eventId)}')`;
        const resetFn = isRelatedMember ?
          `resetEventRelatedMemberAttendance('${escapeHtml(eventId)}', '${escapeHtml(memberAlias)}')` :
          `resetEventAttendance('${escapeHtml(eventId)}')`;
        
        const noAttendingText = isRelatedMember ? 'No assistirà' : 'No assistiré';
        const noAttendingTitle = isRelatedMember ? 'No assistirà' : 'No assistiré';
        
        let button1Html = '';
        let button2Html = '';
        
        if (attending === true) {
          button1Html = `<button type="button" class="btn btn-xs btn-outline-secondary" onclick="${resetFn}" title="Restablir a no confirmat">↩ Restablir</button>`;
          button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="${rejectFn}" title="${noAttendingTitle}">✕ ${noAttendingText}</button>`;
        } else if (attending === false) {
          button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="${confirmFn}" title="Confirmar assistència">✔ Confirmar</button>`;
          button2Html = `<button type="button" class="btn btn-xs btn-outline-secondary" onclick="${resetFn}" title="Restablir a no confirmat">↩ Restablir</button>`;
        } else {
          button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="${confirmFn}" title="Confirmar assistència">✔ Confirmar</button>`;
          button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="${rejectFn}" title="${noAttendingTitle}">✕ ${noAttendingText}</button>`;
        }
        
        buttonsContainer.innerHTML = button1Html + button2Html;
      }
      
      showToast('Confirmació actualitzada', 'success');
      
      // Update local event data in cache
      const events = CACHE.getEvents() || [];
      const eventIndex = events.findIndex(e => e.id === eventId);
      if (eventIndex !== -1) {
        const event = events[eventIndex];
        if (!event.attendees) event.attendees = [];
        if (!event.rejections) event.rejections = [];
        
        // Remove member from both lists
        event.attendees = event.attendees.filter(a => a !== memberAlias);
        event.rejections = event.rejections.filter(r => r !== memberAlias);
        
        // Add member to the appropriate list based on new status
        if (attending === true) {
          event.attendees.push(memberAlias);
        } else if (attending === false) {
          event.rejections.push(memberAlias);
        }
        
        CACHE.saveEvents({ events });
        
        // Update APP.currentEventData if it's the same event
        if (APP.currentEventData && APP.currentEventData.id === eventId) {
          APP.currentEventData.attendees = event.attendees;
          APP.currentEventData.rejections = event.rejections;
        }
      }
    })
    .catch(function(error) {
      console.error('Error updating event attendance:', error);
      showToast(error || 'Error actualitzant confirmació', 'error');
      if (statusIndicator && originalStatusHtml) {
        statusIndicator.outerHTML = originalStatusHtml;
      }
      if (buttonsContainer && originalButtonsHtml) {
        buttonsContainer.innerHTML = originalButtonsHtml;
      }
    });
}