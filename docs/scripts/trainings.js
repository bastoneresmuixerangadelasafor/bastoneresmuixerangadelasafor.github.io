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
  if (APP.currentTrainingId === trainingId) {
    return;
  }
  
  APP.currentTrainingId = trainingId;

  APP.showLoading(true);

  API.getTrainingById({ trainingId })
    .then(function (trainingData) {
      APP.showLoading(false);

      if (!trainingData) {
        showToast("No s'ha trobat l'assaig", "error");
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
      }

      // Update page header to "Assaig" (editing mode)
      updateTrainingPageTitle(true);

      // Store training data for later use (e.g. attendance list)
      APP.currentTrainingData = trainingData;

      // Apply editable state based on admin role
      applyTrainingEditableState();

      // Detect dances from the loaded description (visible to all users)
      detectAndDisplayDancesFromDescription();

      // Initialize form event listeners for dance detection
      initializeTrainingFormListeners();

      // Show/hide attendance section (admin only)
      prepareTrainingAttendanceSection();

      showToast("Assaig carregat", "success");
    })
    .catch(function (error) {
      APP.showLoading(false);
      console.error("Error loading training:", error);
      showToast("Error carregant l'assaig", "error");
    });
}

/**
 * Apply editable state to training fields based on user role
 * Only admins can edit training details
 */
function applyTrainingEditableState() {
  const isAdmin = APP.currentUser && (APP.currentUser.roles || []).includes("ADMIN");
  
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
    if (saveBtnTraining) saveBtnTraining.disabled = false;
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
    if (saveBtnTraining) saveBtnTraining.disabled = true;
    
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
  const saveBtnTraining = document.getElementById("floating-save-training-btn");
  const attendanceToggle = document.getElementById("training-attendance-toggle");
  
  if (!trainingDescriptionInput) {
    return;
  }

  // Remove any existing listeners to avoid duplicates
  const newInput = trainingDescriptionInput.cloneNode(true);
  trainingDescriptionInput.parentNode.replaceChild(newInput, trainingDescriptionInput);

  // Add input event listener to detect dances as description changes
  newInput.addEventListener("input", detectAndDisplayDancesFromDescription);

  // Add save button listener
  if (saveBtnTraining) {
    // Clone to remove old listeners
    const newSaveBtn = saveBtnTraining.cloneNode(true);
    saveBtnTraining.parentNode.replaceChild(newSaveBtn, saveBtnTraining);
    
    newSaveBtn.addEventListener("click", handleTrainingSave);
  }

  // Add attendance section toggle listener
  if (attendanceToggle && !attendanceToggle.dataset.initialized) {
    attendanceToggle.addEventListener("click", function () {
      const attendanceList = document.getElementById("training-member-attendance-list");
      const toggleArrow = attendanceToggle.querySelector(".toggle-arrow");
      
      if (attendanceList) {
        const isCollapsed = attendanceList.classList.contains("collapsed");
        
        // If we are opening (currently collapsed), load the data
        if (isCollapsed) {
          loadTrainingMembersAttendance(APP.currentTrainingData);
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
 * Prepare the training attendance section (show/hide based on admin role)
 */
function prepareTrainingAttendanceSection() {
  const isAdmin = APP.currentUser && (APP.currentUser.roles || []).includes("ADMIN");
  const attendanceSection = document.getElementById("training-member-attendance-section");
  const attendanceList = document.getElementById("training-member-attendance-list");
  const attendanceToggle = document.getElementById("training-attendance-toggle");
  
  if (!attendanceSection || !attendanceList) {
    return;
  }
  
  if (isAdmin) {
    attendanceSection.style.display = "";
    // Reset to collapsed state on load
    attendanceList.classList.add("collapsed");
    if (attendanceToggle) {
      const toggleArrow = attendanceToggle.querySelector(".toggle-arrow");
      if (toggleArrow) toggleArrow.textContent = "▶";
      attendanceToggle.setAttribute("aria-expanded", "false");
    }
    // Clear list
    attendanceList.innerHTML = "";
  } else {
    attendanceSection.style.display = "none";
  }
}

/**
 * Load members and display attendance list for training session (admin only)
 * @param {Object} trainingData - Training data object with attendance and rejections
 */
function loadTrainingMembersAttendance(trainingData) {
  if (!trainingData) {
    trainingData = APP.currentTrainingData;
  }
  
  const attendanceList = document.getElementById("training-member-attendance-list");
  if (!attendanceList) return;
  
  // Show loader while fetching members
  attendanceList.innerHTML = '<div class="training-member-attendance-loading" id="training-members-loader"><div class="spinner"></div><span>Carregant membres...</span></div>';
  
  // Fetch members
  API.getMembers()
    .then(function (members) {
      if (Array.isArray(members)) {
        MEMBERS.membersData = members; 
        displayMemberAttendanceList(trainingData);
      }
    })
    .catch(function (error) {
      console.error("Error loading members for training:", error);
      attendanceList.innerHTML = '<div class="training-member-attendance-loading">Error al carregar membres</div>';
    });
}

/**
 * Display member attendance list for training session (admin only)
 * @param {Object} trainingData - Training data object with attendance and rejections
 */
function displayMemberAttendanceList(trainingData) {
  // Check if user is admin
  const isAdmin = APP.currentUser && (APP.currentUser.roles || []).includes("ADMIN");
  
  const attendanceSection = document.getElementById("training-member-attendance-section");
  const attendanceList = document.getElementById("training-member-attendance-list");
  
  if (!attendanceSection || !attendanceList) {
    return;
  }
  
  // Hide if not admin
  if (!isAdmin) {
    attendanceSection.style.display = "none";
    return;
  }
  
  // Show the section
  attendanceSection.style.display = "";
  
  // Get members list
  const members = (MEMBERS.membersData || []).filter(m => m.active);
  
  if (!members || members.length === 0) {
    attendanceList.innerHTML = '<div class="training-member-attendance-loading">Sense membres disponibles</div>';
    return;
  }
  
  // Get attendance and rejection lists from training data
  const attendanceList_aliases = trainingData.assistance || [];
  const rejectionList_aliases = trainingData.rejections || [];
  
  // Build HTML for member list
  const membersHTML = members.map(member => {
    const displayName = member.name || member.alias;
    const memberAlias = member.alias;
    
    let statusClass = "empty";
    let statusSymbol = "☐"; // empty checkbox
    
    // Use alias for comparison as that's what's used in the database
    if (rejectionList_aliases.includes(memberAlias)) {
      statusClass = "rejected";
      statusSymbol = "✕"; // red X
    } else if (attendanceList_aliases.includes(memberAlias)) {
      statusClass = "attending";
      statusSymbol = "✓"; // green tick
    }
    
    return `
      <div class="training-member-item">
        <div class="training-member-status ${statusClass}">${statusSymbol}</div>
        <div class="training-member-name">${displayName}</div>
      </div>
    `;
  }).join("");
  
  attendanceList.innerHTML = membersHTML;
}

/**
 * Handle training session save
 */
function handleTrainingSave() {
  const trainingDatetimeInput = document.getElementById("training-datetime-input");
  const trainingDescriptionInput = document.getElementById("training-description-input");
  const saveBtnTraining = document.getElementById("floating-save-training-btn");

  // Validate required fields
  if (!trainingDatetimeInput || !trainingDatetimeInput.value) {
    showToast("La data de l'assaig és obligatòria", "error");
    return;
  }

  // Determine if we're editing or creating
  // If currentTrainingId is set, we're editing; otherwise we're creating
  const isEditing = !!APP.currentTrainingId;
  const trainingId = isEditing ? APP.currentTrainingId : trainingDatetimeInput.value;

  // Prepare training data
  // The 'date' field is the training ID (key in the system)
  const training = {
    date: trainingId,
    description: trainingDescriptionInput ? trainingDescriptionInput.value : "",
  };

  // Show loading state
  if (saveBtnTraining) {
    saveBtnTraining.disabled = true;
  }
  APP.showLoading(true);

  // Call API to save training
  API.saveTraining({ training })
    .then(function (response) {
      APP.showLoading(false);
      if (saveBtnTraining) {
        saveBtnTraining.disabled = false;
      }

      // If we reach here, the save was successful (API client would have rejected on error)
      showToast(response?.message || "Assaig desat correctament", "success");
      
      // If this was a new training, update the current ID
      if (!isEditing && response?.trainingId) {
        APP.currentTrainingId = response.trainingId;
        refreshPlanningTrainings();
      }
    })
    .catch(function (error) {
      APP.showLoading(false);
      if (saveBtnTraining) {
        saveBtnTraining.disabled = false;
      }
      console.error("Error saving training:", error);
      showToast(error || "Error desant l'assaig", "error");
    });
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
    showDialogWithBackdrop(dialog);
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
  showDialogWithBackdrop(dialog);
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
    closeDialogWithBackdrop(dialog);
  }
}

/**
 * Quick navigate to training (backward compatibility)
 */
function navigateToTraining(trainingId) {
  if (!trainingId) return;
  APP.trainingIdToLoad = escapeHtml(trainingId);
  window.location.hash = "training/" + encodeURIComponent(trainingId);
}

/**
 * Toggle current user's attendance for a training session
 * @param {string} trainingId - The training ID (date key)
 * @param {HTMLElement} element - The clicked badge element
 */
function toggleTrainingAttendance(trainingId, element) {
  if (!trainingId || !element) return;

  // Save original content for restoration on error
  var originalHtml = element.innerHTML;
  var originalClass = element.className;

  // Show inline spinner and disable interaction
  element.style.pointerEvents = "none";
  element.innerHTML = '<span class="training-confirmation-spinner"></span>';

  API.toggleTrainingAttendance({ trainingId: trainingId })
    .then(function (result) {
      // Update the badge based on the new status
      const statusClass = "training-confirmation " + result.status;
      let statusText = '? No confirmat';
      
      if (result.status === 'confirmed') {
        statusText = '✔ Confirmat';
      } else if (result.status === 'not-attending') {
        statusText = '✕ No assistiré';
      }
      
      element.className = statusClass;
      element.innerHTML = statusText;
      showToast(result.message || "Estat actualitzat", "success");

      // Update the attendance count on the same card
      var card = element.closest(".training-card");
      if (card) {
        var countSpan = card.querySelector(".training-count");
        if (countSpan && result.status === 'confirmed') {
          var currentText = countSpan.textContent;
          var match = currentText.match(/(\d+)/);
          if (match) {
            var count = parseInt(match[1], 10);
            // If transitioning to 'confirmed', increment count
            if (result.value === 'SI') {
              count = count + 1;
            }
            countSpan.textContent = count + " persones apuntades";
          }
        }
      }
    })
    .catch(function (error) {
      console.error("Error toggling attendance:", error);
      // Restore original state on error
      element.className = originalClass;
      element.innerHTML = originalHtml;
      showToast(error || "Error actualitzant l'assistència", "error");
    })
    .finally(function () {
      element.style.pointerEvents = "";
    });
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
  function createTrainingCardHTML(training, isPast = false) {
    const formattedDate = formatEventDate(training.date);
    let meetingPlaceHtml = "";
    if (training.meetingPlace) {
      meetingPlaceHtml = `<span class="training-card-location">📍 ${escapeHtml(training.meetingPlace)}</span>`;
    }
    
    // For past trainings, show attendance indicator
    let attendanceIndicatorHtml = "";
    if (isPast && APP.currentUser) {
      const isAttending = (training.assistance || []).some(function(attendee) {
        return attendee === APP.currentUser.alias;
      });
      
      if (isAttending) {
        attendanceIndicatorHtml = `<span class="training-attendance attending">✓ Has assistit</span>`;
      } else {
        attendanceIndicatorHtml = `<span class="training-attendance not-attending">✕ No has assistit</span>`;
      }
    }

    // For upcoming trainings, show clickable confirmation status based on user attendance
    let confirmationStatusHtml = "";
    if (!isPast && APP.currentUser) {
      // Calculate user's status from attendance and rejections lists
      const isConfirmed = (training.assistance || []).some(function(attendee) {
        return attendee === APP.currentUser.alias;
      });
      const isRejected = (training.rejections || []).some(function(rejector) {
        return rejector === APP.currentUser.alias;
      });
      
      let statusClass = 'training-confirmation not-confirmed';
      let statusText = '? No confirmat';
      
      if (isConfirmed) {
        statusClass = 'training-confirmation confirmed';
        statusText = '✔ Confirmat';
      } else if (isRejected) {
        statusClass = 'training-confirmation not-attending';
        statusText = '✕ No assistiré';
      }
      
      confirmationStatusHtml = `<span class="${statusClass}" onclick="toggleTrainingAttendance('${escapeHtml(training.id)}', this)" role="button" tabindex="0">${statusText}</span>`;
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
    ${attendanceIndicatorHtml}
    ${confirmationStatusHtml}
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
    // Sort upcoming trainings by date descending (newer/furthest future first)
    upcomingTrainings.sort(function (a, b) {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });

    const upcomingHTML = upcomingTrainings.map(function(t) { return createTrainingCardHTML(t, false); }).join("");
    container.innerHTML = upcomingHTML;
  }

  // Render past trainings in collapsible
  if (pastTrainingsContainer) {
    if (pastTrainings.length === 0) {
      pastTrainingsContainer.innerHTML = '<div class="past-training-empty">No hi ha assajos passats</div>';
    } else {
      // Sort past trainings by date descending (newest/most recent first)
      pastTrainings.sort(function (a, b) {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
      const pastHTML = pastTrainings.map(function(t) { return createTrainingCardHTML(t, true); }).join("");
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
 * Reset the training form to empty state for creating a new training
 */
function resetTrainingForm() {
  // Clear the current training ID (we're creating a new one)
  APP.currentTrainingId = null;
  APP.currentTrainingData = null;

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
    // Hide member attendance section when form is reset
    const trainingMemberAttendanceSection = document.getElementById("training-member-attendance-section");
    if (trainingMemberAttendanceSection) {
      trainingMemberAttendanceSection.style.display = "none";
    }
  }

  // Update page header to "Nou assaig"
  updateTrainingPageTitle(false);

  // Apply editable state (admin-only)
  applyTrainingEditableState();

  // Initialize form event listeners for dance detection
  initializeTrainingFormListeners();
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