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
