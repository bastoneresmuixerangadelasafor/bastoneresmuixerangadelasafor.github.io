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
  
  // Reset manual unlock state when loading a new training
  if (typeof isTrainingManuallyUnlocked !== "undefined") {
    isTrainingManuallyUnlocked = false;
  }

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
 * Apply editable state to training fields based on user role and training date
 * Only admins can edit training details, and past trainings are locked by default
 */
function applyTrainingEditableState() {
  const isAdmin = APP.currentUser && (APP.currentUser.roles || []).includes("ADMIN");
  
  // Check if training is editable (future date or manually unlocked)
  const isEditable = typeof checkIfTrainingIsEditable === "function" ? checkIfTrainingIsEditable() : true;
  
  const trainingDatetimeInput = document.getElementById("training-datetime-input");
  const trainingDescriptionInput = document.getElementById("training-description-input");
  const trainingDatetimeLabel = document.getElementById("training-datetime-label");
  const trainingDescriptionLabel = document.getElementById("training-description-label");
  const saveBtnTraining = document.getElementById("floating-save-training-btn");
  const lockBtnTraining = document.getElementById("floating-lock-training-btn");

  if (isAdmin && isEditable) {
    // Admin with editable training: Show inputs, hide labels, show save, hide lock
    if (trainingDatetimeInput) trainingDatetimeInput.style.display = "";
    if (trainingDescriptionInput) trainingDescriptionInput.style.display = "";
    if (trainingDatetimeLabel) trainingDatetimeLabel.style.display = "none";
    if (trainingDescriptionLabel) trainingDescriptionLabel.style.display = "none";
    if (saveBtnTraining) saveBtnTraining.style.display = "";
    if (lockBtnTraining) lockBtnTraining.style.display = "none";
    
    // Enable fields
    if (trainingDatetimeInput) trainingDatetimeInput.disabled = false;
    if (trainingDescriptionInput) trainingDescriptionInput.disabled = false;
    if (saveBtnTraining) saveBtnTraining.disabled = false;
  } else if (isAdmin && !isEditable) {
    // Admin with past/locked training: Show labels, hide inputs, hide save, show lock
    if (trainingDatetimeInput) trainingDatetimeInput.style.display = "none";
    if (trainingDescriptionInput) trainingDescriptionInput.style.display = "none";
    if (trainingDatetimeLabel) trainingDatetimeLabel.style.display = "";
    if (trainingDescriptionLabel) trainingDescriptionLabel.style.display = "";
    if (saveBtnTraining) saveBtnTraining.style.display = "none";
    if (lockBtnTraining) lockBtnTraining.style.display = "flex";
    
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
  } else {
    // Non-admin: Show labels, hide inputs, hide both save and lock
    if (trainingDatetimeInput) trainingDatetimeInput.style.display = "none";
    if (trainingDescriptionInput) trainingDescriptionInput.style.display = "none";
    if (trainingDatetimeLabel) trainingDatetimeLabel.style.display = "";
    if (trainingDescriptionLabel) trainingDescriptionLabel.style.display = "";
    if (saveBtnTraining) saveBtnTraining.style.display = "none";
    if (lockBtnTraining) lockBtnTraining.style.display = "none";
    
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
    let isChecked = false;
    
    // Use alias for comparison as that's what's used in the database
    if (rejectionList_aliases.includes(memberAlias)) {
      statusClass = "rejected";
      isChecked = false;
    } else if (attendanceList_aliases.includes(memberAlias)) {
      statusClass = "attending";
      isChecked = true;
    }
    
    return `
      <div class="training-member-item">
        <label class="training-member-checkbox-label">
          <input type="checkbox" class="training-member-checkbox" data-alias="${memberAlias}" ${isChecked ? 'checked' : ''} />
          <span class="training-member-checkbox-custom ${statusClass}"></span>
          <span class="training-member-name">${displayName}</span>
        </label>
      </div>
    `;
  }).join("");
  
  attendanceList.innerHTML = membersHTML;
  
  // Add event listeners to checkboxes
  attendanceList.querySelectorAll('.training-member-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleMemberAttendanceChange);
  });
  
  // Scroll attendance list to top
  attendanceList.scrollTop = 0;
}

/**
 * Handle checkbox change for member attendance
 * @param {Event} event - The change event
 */
function handleMemberAttendanceChange(event) {
  const checkbox = event.target;
  const memberAlias = checkbox.dataset.alias;
  const attending = checkbox.checked;
  const trainingId = APP.currentTrainingId;
  
  if (!trainingId || !memberAlias) {
    console.error('Missing trainingId or memberAlias');
    return;
  }
  
  // Disable checkbox while processing
  checkbox.disabled = true;
  const customCheckbox = checkbox.nextElementSibling;
  customCheckbox.classList.add('loading');
  
  API.adminSetMemberAttendance({ trainingId, memberAlias, attending })
    .then(function(response) {
      // Update visual state
      customCheckbox.classList.remove('loading', 'empty', 'attending', 'rejected');
      customCheckbox.classList.add(attending ? 'attending' : 'empty');
      
      // Update local training data
      if (APP.currentTrainingData) {
        const assistanceList = APP.currentTrainingData.assistance || [];
        if (attending) {
          if (!assistanceList.includes(memberAlias)) {
            assistanceList.push(memberAlias);
          }
        } else {
          const index = assistanceList.indexOf(memberAlias);
          if (index > -1) {
            assistanceList.splice(index, 1);
          }
        }
        APP.currentTrainingData.assistance = assistanceList;
      }
    })
    .catch(function(error) {
      console.error('Error updating attendance:', error);
      showToast(error || 'Error actualitzant assistència', 'error');
      // Revert checkbox state
      checkbox.checked = !attending;
    })
    .finally(function() {
      checkbox.disabled = false;
      customCheckbox.classList.remove('loading');
    });
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
 * Confirm training attendance for current user
 * @param {string} trainingId - The training ID (date key)
 */
function confirmAttendance(trainingId) {
  handleAttendanceAction(trainingId, 'confirm');
}

/**
 * Cancel training attendance for current user (mark as not attending)
 * @param {string} trainingId - The training ID (date key)
 */
function cancelAttendance(trainingId) {
  handleAttendanceAction(trainingId, 'cancel');
}

/**
 * Reset training attendance for current user (back to not confirmed)
 * @param {string} trainingId - The training ID (date key)
 */
function resetAttendance(trainingId) {
  handleAttendanceAction(trainingId, 'reset');
}

/**
 * Confirm training attendance for a related member
 * @param {string} trainingId - The training ID (date key)
 * @param {string} memberId - The ID of the related member
 * @param {string} memberAlias - The alias of the related member
 */
function confirmRelatedMemberAttendance(trainingId, memberId, memberAlias) {
  handleRelatedMemberAttendanceAction(trainingId, memberId, memberAlias, 'confirm');
}

/**
 * Cancel training attendance for a related member (mark as not attending)
 * @param {string} trainingId - The training ID (date key)
 * @param {string} memberId - The ID of the related member
 * @param {string} memberAlias - The alias of the related member
 */
function cancelRelatedMemberAttendance(trainingId, memberId, memberAlias) {
  handleRelatedMemberAttendanceAction(trainingId, memberId, memberAlias, 'cancel');
}

/**
 * Reset training attendance for a related member (back to not confirmed)
 * @param {string} trainingId - The training ID (date key)
 * @param {string} memberId - The ID of the related member
 * @param {string} memberAlias - The alias of the related member
 */
function resetRelatedMemberAttendance(trainingId, memberId, memberAlias) {
  handleRelatedMemberAttendanceAction(trainingId, memberId, memberAlias, 'reset');
}

/**
 * Handle attendance action for a related member (confirm, cancel, or reset)
 * @param {string} trainingId - The training ID (date key)
 * @param {string} memberId - The ID of the related member
 * @param {string} memberAlias - The alias of the related member
 * @param {string} action - The action to perform: 'confirm', 'cancel', or 'reset'
 */
function handleRelatedMemberAttendanceAction(trainingId, memberId, memberAlias, action) {
  if (!trainingId || !memberId || !memberAlias) return;

  // Find the confirmation section for this training and member
  const section = document.querySelector(`.training-confirmation-section[data-training-id="${trainingId}"][data-member-id="${memberId}"]`);
  if (!section) return;

  const statusIndicator = section.querySelector('.training-status-indicator');
  const buttonsContainer = section.querySelector('.training-confirmation-buttons');
  
  // Save original content for restoration on error
  const originalStatusHtml = statusIndicator ? statusIndicator.outerHTML : '';
  const originalButtonsHtml = buttonsContainer ? buttonsContainer.innerHTML : '';

  // Show loading state
  if (buttonsContainer) {
    buttonsContainer.innerHTML = '<span class="training-confirmation-spinner"></span>';
  }

  // Call the appropriate API
  let apiCall;
  if (action === 'confirm') {
    apiCall = API.confirmRelatedMemberAttendance({ trainingId: trainingId, memberId: memberId, memberAlias: memberAlias });
  } else if (action === 'cancel') {
    apiCall = API.cancelRelatedMemberAttendance({ trainingId: trainingId, memberId: memberId, memberAlias: memberAlias });
  } else {
    apiCall = API.resetRelatedMemberAttendance({ trainingId: trainingId, memberId: memberId, memberAlias: memberAlias });
  }

  apiCall
    .then(function (result) {
      // Update the status indicator
      if (statusIndicator) {
        statusIndicator.className = 'training-status-indicator ' + result.status;
        if (result.status === 'confirmed') {
          statusIndicator.textContent = '✔ Confirmat';
        } else if (result.status === 'not-attending') {
          statusIndicator.textContent = '✕ No assistirà';
        } else {
          statusIndicator.textContent = '? No confirmat';
        }
      }
      
      // Update the buttons based on new status
      if (buttonsContainer) {
        const escapedTrainingId = escapeHtml(trainingId);
        const escapedMemberId = escapeHtml(memberId);
        const escapedMemberAlias = escapeHtml(memberAlias);
        let button1Html = '';
        let button2Html = '';
        
        if (result.status === 'confirmed') {
          button1Html = `<button type="button" class="btn btn-xs btn-outline-secondary" onclick="resetRelatedMemberAttendance('${escapedTrainingId}', '${escapedMemberId}', '${escapedMemberAlias}')" title="Restablir a no confirmat">↩ Restablir</button>`;
          button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="cancelRelatedMemberAttendance('${escapedTrainingId}', '${escapedMemberId}', '${escapedMemberAlias}')" title="No assistirà">✕ No assistirà</button>`;
        } else if (result.status === 'not-attending') {
          button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="confirmRelatedMemberAttendance('${escapedTrainingId}', '${escapedMemberId}', '${escapedMemberAlias}')" title="Confirmar assistència">✔ Confirmar</button>`;
          button2Html = `<button type="button" class="btn btn-xs btn-outline-secondary" onclick="resetRelatedMemberAttendance('${escapedTrainingId}', '${escapedMemberId}', '${escapedMemberAlias}')" title="Restablir a no confirmat">↩ Restablir</button>`;
        } else {
          button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="confirmRelatedMemberAttendance('${escapedTrainingId}', '${escapedMemberId}', '${escapedMemberAlias}')" title="Confirmar assistència">✔ Confirmar</button>`;
          button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="cancelRelatedMemberAttendance('${escapedTrainingId}', '${escapedMemberId}', '${escapedMemberAlias}')" title="No assistirà">✕ No assistirà</button>`;
        }
        
        buttonsContainer.innerHTML = button1Html + button2Html;
      }
      
      // Update note link visibility
      const memberNameSpan = section.querySelector('.training-confirmation-member-name');
      const memberName = memberNameSpan ? memberNameSpan.textContent : memberAlias;
      let existingNoteLink = section.querySelector('.training-note-link');
      if (result.status === 'confirmed' || result.status === 'not-attending') {
        if (!existingNoteLink) {
          const escapedMemberName = escapeHtml(memberName);
          const noteLinkHtml = `<a href="javascript:void(0)" class="training-note-link" onclick="openTrainingNoteDialog('${escapeHtml(trainingId)}', '${escapeHtml(memberId)}', '${escapeHtml(memberAlias)}', '${escapedMemberName}')">+ Afegir nota</a>`;
          const newLink = document.createElement('span');
          newLink.innerHTML = noteLinkHtml;
          section.appendChild(newLink.firstChild);
        }
      } else {
        if (existingNoteLink) {
          existingNoteLink.remove();
        }
      }
      
      showToast(result.message || "Estat actualitzat", "success");

      // Update local training data
      if (memberAlias) {
        const trainings = CACHE.getTrainings() || [];
        const trainingIndex = trainings.findIndex(t => t.id === trainingId);
        if (trainingIndex !== -1) {
          const training = trainings[trainingIndex];
          if (!training.assistance) training.assistance = [];
          if (!training.rejections) training.rejections = [];
          
          // Remove member from both lists
          training.assistance = training.assistance.filter(a => a !== memberAlias);
          training.rejections = training.rejections.filter(r => r !== memberAlias);
          
          // Add member to the appropriate list based on new status
          if (result.status === 'confirmed') {
            training.assistance.push(memberAlias);
          } else if (result.status === 'not-attending') {
            training.rejections.push(memberAlias);
          }
          
          CACHE.saveTrainings({ trainings });
          
          // Update the count display
          const card = document.querySelector(`.training-card[data-training-id="${trainingId}"]`);
          if (card) {
            const countSpan = card.querySelector('.training-count');
            if (countSpan) {
              countSpan.textContent = training.assistance.length + ' persones apuntades';
            }
          }
        }
      }
    })
    .catch(function (error) {
      console.error("Error updating related member attendance:", error);
      // Restore original state on error
      if (statusIndicator && originalStatusHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = originalStatusHtml;
        statusIndicator.className = tempDiv.firstChild.className;
        statusIndicator.textContent = tempDiv.firstChild.textContent;
      }
      if (buttonsContainer) {
        buttonsContainer.innerHTML = originalButtonsHtml;
      }
      showToast(error.message || "Error actualitzant l'assistència", "error");
    });
}

/**
 * Handle attendance action (confirm, cancel, or reset)
 * @param {string} trainingId - The training ID (date key)
 * @param {string} action - The action to perform: 'confirm', 'cancel', or 'reset'
 */
function handleAttendanceAction(trainingId, action) {
  if (!trainingId) return;

  // Find the confirmation section for this training (current user, without member-alias attribute)
  const section = document.querySelector(`.training-confirmation-section[data-training-id="${trainingId}"]:not([data-member-alias])`);
  if (!section) return;

  const statusIndicator = section.querySelector('.training-status-indicator');
  const buttonsContainer = section.querySelector('.training-confirmation-buttons');
  
  // Save original content for restoration on error
  const originalStatusHtml = statusIndicator ? statusIndicator.outerHTML : '';
  const originalButtonsHtml = buttonsContainer ? buttonsContainer.innerHTML : '';

  // Show loading state
  if (buttonsContainer) {
    buttonsContainer.innerHTML = '<span class="training-confirmation-spinner"></span>';
  }

  // Call the appropriate API
  let apiCall;
  if (action === 'confirm') {
    apiCall = API.confirmTrainingAttendance({ trainingId: trainingId });
  } else if (action === 'cancel') {
    apiCall = API.cancelTrainingAttendance({ trainingId: trainingId });
  } else {
    apiCall = API.resetTrainingAttendance({ trainingId: trainingId });
  }

  apiCall
    .then(function (result) {
      // Update the status indicator
      if (statusIndicator) {
        statusIndicator.className = 'training-status-indicator ' + result.status;
        if (result.status === 'confirmed') {
          statusIndicator.textContent = '✔ Confirmat';
        } else if (result.status === 'not-attending') {
          statusIndicator.textContent = '✕ No assistiré';
        } else {
          statusIndicator.textContent = '? No confirmat';
        }
      }
      
      // Update the buttons based on new status
      if (buttonsContainer) {
        let button1Html = '';
        let button2Html = '';
        
        if (result.status === 'confirmed') {
          button1Html = `<button type="button" class="btn btn-xs btn-outline-secondary" onclick="resetAttendance('${escapeHtml(trainingId)}')" title="Restablir a no confirmat">↩ Restablir</button>`;
          button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="cancelAttendance('${escapeHtml(trainingId)}')" title="No assistiré">✕ No assistiré</button>`;
        } else if (result.status === 'not-attending') {
          button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="confirmAttendance('${escapeHtml(trainingId)}')" title="Confirmar assistència">✔ Confirmar</button>`;
          button2Html = `<button type="button" class="btn btn-xs btn-outline-secondary" onclick="resetAttendance('${escapeHtml(trainingId)}')" title="Restablir a no confirmat">↩ Restablir</button>`;
        } else {
          button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="confirmAttendance('${escapeHtml(trainingId)}')" title="Confirmar assistència">✔ Confirmar</button>`;
          button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="cancelAttendance('${escapeHtml(trainingId)}')" title="No assistiré">✕ No assistiré</button>`;
        }
        
        buttonsContainer.innerHTML = button1Html + button2Html;
      }
      
      // Update note link visibility
      let existingNoteLink = section.querySelector('.training-note-link');
      if (result.status === 'confirmed' || result.status === 'not-attending') {
        if (!existingNoteLink) {
          const noteLinkHtml = `<a href="javascript:void(0)" class="training-note-link" onclick="openTrainingNoteDialog('${escapeHtml(trainingId)}', '', '', '')">+ Afegir nota</a>`;
          const newLink = document.createElement('span');
          newLink.innerHTML = noteLinkHtml;
          section.appendChild(newLink.firstChild);
        }
      } else {
        if (existingNoteLink) {
          existingNoteLink.remove();
        }
      }
      
      showToast(result.message || "Estat actualitzat", "success");

      // Update local training data
      var userAlias = APP.currentUser ? APP.currentUser.alias : null;
      if (userAlias) {
        const trainings = CACHE.getTrainings() || [];
        const trainingIndex = trainings.findIndex(t => t.id === trainingId);
        if (trainingIndex !== -1) {
          const training = trainings[trainingIndex];
          if (!training.assistance) training.assistance = [];
          if (!training.rejections) training.rejections = [];
          
          // Remove user from both lists
          training.assistance = training.assistance.filter(a => a !== userAlias);
          training.rejections = training.rejections.filter(r => r !== userAlias);
          
          // Add user to the appropriate list based on new status
          if (result.status === 'confirmed') {
            training.assistance.push(userAlias);
          } else if (result.status === 'not-attending') {
            training.rejections.push(userAlias);
          }
          
          CACHE.saveTrainings({ trainings });
          
          // Update the count display
          const card = document.querySelector(`.training-card[data-training-id="${trainingId}"]`);
          if (card) {
            const countSpan = card.querySelector('.training-count');
            if (countSpan) {
              countSpan.textContent = training.assistance.length + ' persones apuntades';
            }
          }
        }
      }
    })
    .catch(function (error) {
      console.error("Error updating attendance:", error);
      // Restore original state on error
      if (statusIndicator && originalStatusHtml) {
        statusIndicator.outerHTML = originalStatusHtml;
      }
      if (buttonsContainer) {
        buttonsContainer.innerHTML = originalButtonsHtml;
      }
      showToast(error || "Error actualitzant l'assistència", "error");
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
      const relatedMembers = APP.currentUser.relatedMembers || [];
      const hasRelatedMembers = relatedMembers.length > 0;
      
      function generateAttendanceSection(memberAlias, memberName, isRelatedMember, showName) {
        const isAttending = (training.assistance || []).some(function(attendee) {
          return attendee === memberAlias;
        });
        const memberNote = (training.notes || {})[memberAlias];
        const noteHtml = memberNote ? `<span class="training-attendance-note" title="${escapeHtml(memberNote)}">ℹ️ «${escapeHtml(memberNote)}»</span>` : '';
        
        const sectionClass = isRelatedMember ? 'training-confirmation-section related-member past' : 'training-confirmation-section past';
        let statusClass = '';
        let statusText = '';
        
        if (isAttending) {
          statusClass = 'training-status-indicator confirmed';
          statusText = `✓ ${isRelatedMember ? 'Ha assistit' : 'Has assistit'}`;
        } else {
          statusClass = 'training-status-indicator not-attending';
          statusText = `✕ ${isRelatedMember ? 'No ha assistit' : 'No has assistit'}`;
        }
        
        const nameHtml = showName ? `<span class="training-confirmation-member-name">${escapeHtml(memberName)}</span>` : '';
        
        return `
          <div class="${sectionClass}">
            ${nameHtml}
            <span class="${statusClass}">${statusText}</span>
            ${noteHtml}
          </div>`;
      }
      
      const currentUserName = APP.currentUser.displayName || APP.currentUser.alias || 'Tu';
      attendanceIndicatorHtml = generateAttendanceSection(APP.currentUser.alias, currentUserName, false, hasRelatedMembers);
      
      relatedMembers.forEach(function(rm) {
        if (rm.alias) {
          const rmName = rm.name || rm.alias;
          attendanceIndicatorHtml += generateAttendanceSection(rm.alias, rmName, true, true);
        }
      });
    }

    // For upcoming trainings, show current status with action buttons
    let confirmationStatusHtml = "";
    if (!isPast && APP.currentUser) {
      const relatedMembersFuture = APP.currentUser.relatedMembers || [];
      const hasRelatedMembersFuture = relatedMembersFuture.length > 0;
      
      // Helper function to generate confirmation section HTML for a member
      function generateConfirmationSection(memberId, memberAlias, memberName, isRelatedMember, showName) {
        const isConfirmed = (training.assistance || []).some(function(attendee) {
          return attendee === memberAlias;
        });
        const isRejected = (training.rejections || []).some(function(rejector) {
          return rejector === memberAlias;
        });
        const memberNote = (training.notes || {})[memberAlias] || '';
        
        let statusClass = 'training-status-indicator not-confirmed';
        let statusText = '? No confirmat';
        let button1Html = '';
        let button2Html = '';
        let noteLinkHtml = '';
        
        // Use different onclick handlers for related members
        const confirmFn = isRelatedMember ? 
          `confirmRelatedMemberAttendance('${escapeHtml(training.id)}', '${escapeHtml(memberId)}', '${escapeHtml(memberAlias)}')` : 
          `confirmAttendance('${escapeHtml(training.id)}')`;
        const cancelFn = isRelatedMember ? 
          `cancelRelatedMemberAttendance('${escapeHtml(training.id)}', '${escapeHtml(memberId)}', '${escapeHtml(memberAlias)}')` : 
          `cancelAttendance('${escapeHtml(training.id)}')`;
        const resetFn = isRelatedMember ? 
          `resetRelatedMemberAttendance('${escapeHtml(training.id)}', '${escapeHtml(memberId)}', '${escapeHtml(memberAlias)}')` : 
          `resetAttendance('${escapeHtml(training.id)}')`;
        const openNoteFn = isRelatedMember ?
          `openTrainingNoteDialog('${escapeHtml(training.id)}', '${escapeHtml(memberId)}', '${escapeHtml(memberAlias)}', '${escapeHtml(memberName)}')` :
          `openTrainingNoteDialog('${escapeHtml(training.id)}', '', '', '')`;
        
        const notAttendingText = isRelatedMember ? 'No assistirà' : 'No assistiré';
        const notAttendingTitle = isRelatedMember ? 'No assistirà' : 'No assistiré';
        
        if (isConfirmed) {
          statusClass = 'training-status-indicator confirmed';
          statusText = '✔ Confirmat';
          button1Html = `<button type="button" class="btn btn-xs btn-outline-secondary" onclick="${resetFn}" title="Restablir a no confirmat">↩ Restablir</button>`;
          button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="${cancelFn}" title="${notAttendingTitle}">✕ ${notAttendingText}</button>`;
          noteLinkHtml = memberNote ? 
            `<a href="javascript:void(0)" class="training-note-link has-note" onclick="${openNoteFn}" title="Editar nota">ℹ️ «${escapeHtml(memberNote)}»</a>` :
            `<a href="javascript:void(0)" class="training-note-link" onclick="${openNoteFn}">+ Afegir nota</a>`;
        } else if (isRejected) {
          statusClass = 'training-status-indicator not-attending';
          statusText = `✕ ${notAttendingText}`;
          button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="${confirmFn}" title="Confirmar assistència">✔ Confirmar</button>`;
          button2Html = `<button type="button" class="btn btn-xs btn-outline-secondary" onclick="${resetFn}" title="Restablir a no confirmat">↩ Restablir</button>`;
          noteLinkHtml = memberNote ? 
            `<a href="javascript:void(0)" class="training-note-link has-note" onclick="${openNoteFn}" title="Editar nota">ℹ️ «${escapeHtml(memberNote)}»</a>` :
            `<a href="javascript:void(0)" class="training-note-link" onclick="${openNoteFn}">+ Afegir nota</a>`;
        } else {
          button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="${confirmFn}" title="Confirmar assistència">✔ Confirmar</button>`;
          button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="${cancelFn}" title="${notAttendingTitle}">✕ ${notAttendingText}</button>`;
        }
        
        const sectionClass = isRelatedMember ? 'training-confirmation-section related-member' : 'training-confirmation-section';
        const dataAttr = isRelatedMember ? 
          `data-training-id="${escapeHtml(training.id)}" data-member-id="${escapeHtml(memberId)}"` : 
          `data-training-id="${escapeHtml(training.id)}"`;
        
        const nameHtml = showName ? `<span class="training-confirmation-member-name">${escapeHtml(memberName)}</span>` : '';
        
        return `
          <div class="${sectionClass}" ${dataAttr}>
            ${nameHtml}
            <span class="${statusClass}">${statusText}</span>
            <div class="training-confirmation-buttons">
              ${button1Html}
              ${button2Html}
            </div>
            ${noteLinkHtml}
          </div>`;
      }
      
      // Generate confirmation section for the current user
      const currentUserName = APP.currentUser.displayName || APP.currentUser.alias || 'Tu';
      confirmationStatusHtml = generateConfirmationSection(APP.currentUser.memberId, APP.currentUser.alias, currentUserName, false, hasRelatedMembersFuture);
      
      // Generate confirmation sections for related members
      relatedMembersFuture.forEach(function(rm) {
        if (rm.alias && rm.id) {
          const rmName = rm.name || rm.alias;
          confirmationStatusHtml += generateConfirmationSection(rm.id, rm.alias, rmName, true, true);
        }
      });
    }
    
    const actionHtml = `
      <div class="training-card-action-group">
        <button type="button" class="training-card-btn view-btn" onclick="navigateToTraining('${escapeHtml(training.id)}')">Detalls</button>
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
  
  // Reset manual unlock state for new trainings
  if (typeof isTrainingManuallyUnlocked !== "undefined") {
    isTrainingManuallyUnlocked = false;
  }

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

var trainingNoteDialogState = {
  trainingId: null,
  memberId: null,
  memberAlias: null,
  memberName: null
};

function openTrainingNoteDialog(trainingId, memberId, memberAlias, memberName) {
  const dialog = document.getElementById('training-note-dialog');
  const noteInput = document.getElementById('training-note-input');
  const memberNameSpan = document.getElementById('training-note-member-name');
  const charCount = document.getElementById('training-note-char-current');
  
  if (!dialog || !noteInput) return;
  
  trainingNoteDialogState = { trainingId, memberId, memberAlias, memberName };
  
  if (memberNameSpan) {
    memberNameSpan.textContent = memberName || '';
    memberNameSpan.style.display = memberName ? '' : 'none';
  }
  
  const trainings = CACHE.getTrainings() || [];
  const training = trainings.find(function(t) { return t.id === trainingId; });
  const alias = memberAlias || (APP.currentUser ? APP.currentUser.alias : '');
  const existingNote = training && training.notes ? (training.notes[alias] || '') : '';
  
  noteInput.value = existingNote;
  if (charCount) charCount.textContent = existingNote.length;
  
  noteInput.oninput = function() {
    if (charCount) charCount.textContent = noteInput.value.length;
  };
  
  showDialogWithBackdrop(dialog);
  noteInput.focus();
}

function closeTrainingNoteDialog() {
  const dialog = document.getElementById('training-note-dialog');
  if (dialog && dialog.open) {
    closeDialogWithBackdrop(dialog);
  }
  trainingNoteDialogState = { trainingId: null, memberId: null, memberAlias: null, memberName: null };
}

function saveTrainingNote() {
  const noteInput = document.getElementById('training-note-input');
  const saveBtn = document.getElementById('training-note-save-btn');
  const btnText = saveBtn ? saveBtn.querySelector('.btn-text') : null;
  const btnLoading = saveBtn ? saveBtn.querySelector('.btn-loading') : null;
  
  if (!noteInput) return;
  
  const note = noteInput.value.trim();
  const { trainingId, memberId, memberAlias } = trainingNoteDialogState;
  
  if (!trainingId) {
    showToast('Error: no s\'ha pogut identificar l\'assaig', 'error');
    return;
  }
  
  if (saveBtn) saveBtn.disabled = true;
  if (btnText) btnText.style.display = 'none';
  if (btnLoading) btnLoading.style.display = 'inline';
  
  let apiCall;
  if (memberId && memberAlias) {
    apiCall = API.saveRelatedMemberTrainingNote({ trainingId, memberId, memberAlias, note });
  } else {
    apiCall = API.saveTrainingNote({ trainingId, note });
  }
  
  apiCall
    .then(function(result) {
      if (saveBtn) saveBtn.disabled = false;
      if (btnText) btnText.style.display = 'inline';
      if (btnLoading) btnLoading.style.display = 'none';
      showToast(result.message || 'Nota desada', 'success');
      
      const alias = memberAlias || (APP.currentUser ? APP.currentUser.alias : '');
      const trainings = CACHE.getTrainings() || [];
      const trainingIndex = trainings.findIndex(function(t) { return t.id === trainingId; });
      if (trainingIndex !== -1) {
        if (!trainings[trainingIndex].notes) trainings[trainingIndex].notes = {};
        if (note) {
          trainings[trainingIndex].notes[alias] = note;
        } else {
          delete trainings[trainingIndex].notes[alias];
        }
        CACHE.saveTrainings({ trainings });
      }
      
      updateNoteLinkInUI(trainingId, memberId, memberAlias, note);
      closeTrainingNoteDialog();
    })
    .catch(function(error) {
      if (saveBtn) saveBtn.disabled = false;
      if (btnText) btnText.style.display = 'inline';
      if (btnLoading) btnLoading.style.display = 'none';
      showToast(error || 'Error desant la nota', 'error');
    });
}

function updateNoteLinkInUI(trainingId, memberId, memberAlias, note) {
  let section;
  if (memberId) {
    section = document.querySelector(`.training-confirmation-section[data-training-id="${trainingId}"][data-member-id="${memberId}"]`);
  } else {
    section = document.querySelector(`.training-confirmation-section[data-training-id="${trainingId}"]:not([data-member-id])`);
  }
  
  if (!section) return;
  
  const existingLink = section.querySelector('.training-note-link');
  if (existingLink) {
    if (note) {
      existingLink.className = 'training-note-link has-note';
      existingLink.textContent = 'ℹ️ «' + note + '»';
      existingLink.title = 'Editar nota';
    } else {
      existingLink.className = 'training-note-link';
      existingLink.textContent = '+ Afegir nota';
      existingLink.title = '';
    }
  }
}

function initializeTrainingNoteDialogListeners() {
  const closeBtn = document.getElementById('training-note-close-btn');
  const cancelBtn = document.getElementById('training-note-cancel-btn');
  const saveBtn = document.getElementById('training-note-save-btn');
  
  if (closeBtn && !closeBtn.dataset.initialized) {
    closeBtn.addEventListener('click', closeTrainingNoteDialog);
    closeBtn.dataset.initialized = 'true';
  }
  
  if (cancelBtn && !cancelBtn.dataset.initialized) {
    cancelBtn.addEventListener('click', closeTrainingNoteDialog);
    cancelBtn.dataset.initialized = 'true';
  }
  
  if (saveBtn && !saveBtn.dataset.initialized) {
    saveBtn.addEventListener('click', saveTrainingNote);
    saveBtn.dataset.initialized = 'true';
  }
}

document.addEventListener('DOMContentLoaded', initializeTrainingNoteDialogListeners);
