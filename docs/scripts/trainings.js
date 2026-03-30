const TRAININGS = new (class TrainingSession {
  constructor() {
    document.addEventListener('DOMContentLoaded', () => TRAININGS.initializeTrainingNoteDialogListeners());
  }

  loadTrainingData(trainingId) {
    if (!trainingId) {
      UI.showToast("ID d'assaig no vàlid", "error");
      return;
    }
  
    APP.currentTrainingId = trainingId;
    
    // Reset manual unlock state when loading a new training
    if (typeof isTrainingManuallyUnlocked !== "undefined") {
      isTrainingManuallyUnlocked = false;
    }
  
    APP.showLoading(true);
  
    API.getTrainingById({ trainingId })
      .then((trainingData) => {
        APP.showLoading(false);
  
        if (!trainingData) {
          UI.showToast("No s'ha trobat l'assaig", "error");
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
  
        // Detect dances from the loaded description (visible to all users)
        TRAININGS.detectAndDisplayDancesFromDescription();
  
        // Initialize form event listeners for dance detection
        TRAININGS.initializeTrainingFormListeners();
  
        // Show/hide attendance section (admin only)
        TRAININGS.prepareTrainingAttendanceSection();
  
        // Update page header to "Assaig" (editing mode)
        TRAININGS.updateTrainingPageTitle(true);
  
        // Store training data for later use (e.g. attendance list)
        APP.currentTrainingData = trainingData;
  
        // Apply editable state based on admin role
        TRAININGS.applyTrainingEditableState();
  
        UI.showToast("Assaig carregat", "success");
      })
      .catch((error) => {
        APP.showLoading(false);
        console.error("Error loading training:", error);
        UI.showToast("Error carregant l'assaig", "error");
      });
  }


  applyTrainingEditableState() {
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

    if (APP.currentTrainingData) {
      this.displayMemberAttendanceList(APP.currentTrainingData);
    }
  }

  updateTrainingPageTitle(isEditing) {
    const pageHeader = document.querySelector("#view-training .page-header h1");
    if (pageHeader) {
      pageHeader.textContent = isEditing ? "Assaig" : "Nou assaig";
    }
  }

  detectAndDisplayDancesFromDescription() {
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
    const detectedDances = TRAININGS.detectDancesFromText(description);
  
    if (detectedDances.length === 0) {
      trainingDetectedDancesSection.style.display = "none";
      return;
    }
  
    // Show the section and populate chips
    trainingDetectedDancesSection.style.display = "flex";
    trainingDetectedDancesChips.innerHTML = "";
  
    detectedDances.forEach((danceName) => {
      const chip = document.createElement("div");
      chip.className = "training-detected-dance-chip";
      chip.textContent = danceName;
      chip.addEventListener("click", () => {
        TRAININGS.openDanceAudioDialog(danceName);
      });
      trainingDetectedDancesChips.appendChild(chip);
    });
  }
  
  
  detectDancesFromText(text) {
    if (!text || typeof DANCES === "undefined" || !Array.isArray(DANCES)) {
      return [];
    }
  
    const detectedDances = [];
    const seenNames = new Set();
  
    // Search for each dance name in the text
    DANCES.forEach((dance) => {
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
  
  
  initializeTrainingFormListeners() {
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
    newInput.addEventListener("input", function() { TRAININGS.detectAndDisplayDancesFromDescription(); });
  
    // Add save button listener
    if (saveBtnTraining) {
      // Clone to remove old listeners
      const newSaveBtn = saveBtnTraining.cloneNode(true);
      saveBtnTraining.parentNode.replaceChild(newSaveBtn, saveBtnTraining);
      
      newSaveBtn.addEventListener("click", function() { TRAININGS.handleTrainingSave(); });
    }
  
    // Add attendance section toggle listener
    if (attendanceToggle && !attendanceToggle.dataset.initialized) {
      attendanceToggle.addEventListener("click", () => {
        const attendanceList = document.getElementById("training-member-attendance-list");
        const toggleArrow = attendanceToggle.querySelector(".toggle-arrow");
        
        if (attendanceList) {
          const isCollapsed = attendanceList.classList.contains("collapsed");
          
          // If we are opening (currently collapsed), load the data
          if (isCollapsed) {
            TRAININGS.loadTrainingMembersAttendance(APP.currentTrainingData);
          }
          
          attendanceList.classList.toggle("collapsed");
          toggleArrow.textContent = attendanceList.classList.contains("collapsed") ? "▶" : "▼";
          attendanceToggle.setAttribute("aria-expanded", !attendanceList.classList.contains("collapsed"));
        }
      });
      attendanceToggle.dataset.initialized = "true";
    }
  }
  
  
  prepareTrainingAttendanceSection() {
    const isAdmin = APP.currentUser && (APP.currentUser.roles || []).includes("ADMIN");
    const attendanceSection = document.getElementById("training-member-attendance-section");
    const attendanceList = document.getElementById("training-member-attendance-list");
    const attendanceToggle = document.getElementById("training-attendance-toggle");
    const countSpan = document.getElementById("training-attendance-count");
    
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
  
      const trainingData = APP.currentTrainingData || {};
      const attendCount = (trainingData.attendees || []).length;
      const rejectCount = (trainingData.rejections || []).length;
      if (countSpan) {
        countSpan.textContent = `${attendCount} SI / ${rejectCount} NO`;
      }
    } else {
      attendanceSection.style.display = "none";
    }
  }
  
  
  loadTrainingMembersAttendance(trainingData) {
    if (!trainingData) {
      trainingData = APP.currentTrainingData;
    }
    
    const attendanceList = document.getElementById("training-member-attendance-list");
    if (!attendanceList) return;
    
    // Show loader while fetching members
    attendanceList.innerHTML = '<div class="training-member-attendance-loading" id="training-members-loader"><div class="spinner"></div><span>Carregant membres...</span></div>';
    
    // Fetch members
    API.getMembers()
      .then((members) => {
        if (Array.isArray(members)) {
          MEMBERS.membersData = members; 
          TRAININGS.displayMemberAttendanceList(trainingData);
        }
      })
      .catch((error) => {
        console.error("Error loading members for training:", error);
        attendanceList.innerHTML = '<div class="training-member-attendance-loading">Error al carregar membres</div>';
      });
  }
  
  
  displayMemberAttendanceList(trainingData) {
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
    
    // Check if training is past
    const isPastTraining = trainingData.date && new Date(trainingData.date) < new Date();
    const isEditable = typeof checkIfTrainingIsEditable === "function" ? checkIfTrainingIsEditable() : true;
    const isDisabledAttendance = isPastTraining && !isEditable;
    
    const members = (MEMBERS.membersData || []).filter(m => m.active);
    
    if (!members || members.length === 0) {
      attendanceList.innerHTML = '<div class="training-member-attendance-loading">Sense membres disponibles</div>';
      return;
    }
    
    // Get attendance and rejection lists from training data
    const attendanceList_aliases = trainingData.attendees || [];
    const rejectionList_aliases = trainingData.rejections || [];
    const memberNotes = trainingData.notes || {};
    
    // Build HTML for member list
    const membersHTML = members.map(member => {
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
      
      const memberNote = memberNotes[memberAlias] || '';
      const noteHtml = memberNote ? `<span class="training-member-note" title="${escapeHtml(memberNote)}">📝 «${escapeHtml(memberNote)}»</span>` : '';
      const disabledAttr = isDisabledAttendance ? 'disabled' : '';
      const disabledClass = isDisabledAttendance ? ' disabled' : '';
      
      return `
        <div class="training-member-item${memberNote ? ' has-note' : ''}${disabledClass}">
          <label class="training-member-checkbox-label">
            <input type="checkbox" class="training-member-checkbox" data-alias="${memberAlias}" ${isChecked ? 'checked' : ''} ${disabledAttr} />
            <span class="training-member-checkbox-custom ${statusClass}"></span>
            <span class="training-member-name">${memberAlias}</span>
          </label>
          ${noteHtml}
        </div>
      `;
    }).join("");
    
    attendanceList.innerHTML = membersHTML;
    
    // Update attendance count
    const countSpan = document.getElementById("training-attendance-count");
    if (countSpan) {
      const attendCount = attendanceList_aliases.length;
      const rejectCount = rejectionList_aliases.length;
      countSpan.textContent = `${attendCount} SI / ${rejectCount} NO`;
    }
    
    // Add event listeners to checkboxes (only if not past training)
    if (!isDisabledAttendance) {
      attendanceList.querySelectorAll('.training-member-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function(event) { TRAININGS.handleMemberAttendanceChange(event); });
      });
    }
    
    // Scroll attendance list to top
    attendanceList.scrollTop = 0;
  }

  handleMemberAttendanceChange(event) {
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
          const attendeesList = APP.currentTrainingData.attendees || [];
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
          APP.currentTrainingData.attendees = attendeesList;
          
          // Update the attendance count
          const countSpan = document.getElementById("training-attendance-count");
          if (countSpan) {
            const attendCount = attendeesList.length;
            const rejectCount = (APP.currentTrainingData.rejections || []).length;
            countSpan.textContent = `${attendCount} SI / ${rejectCount} NO`;
          }
        }
      })
      .catch(function(error) {
        console.error('Error updating attendance:', error);
        UI.showToast(error || 'Error actualitzant assistència', 'error');
        // Revert checkbox state
        checkbox.checked = !attending;
      })
      .finally(function() {
        checkbox.disabled = false;
        customCheckbox.classList.remove('loading');
      });
  }
  
  
  handleTrainingSave() {
    const trainingDatetimeInput = document.getElementById("training-datetime-input");
    const trainingDescriptionInput = document.getElementById("training-description-input");
    const saveBtnTraining = document.getElementById("floating-save-training-btn");
    const saveIcon = saveBtnTraining ? saveBtnTraining.querySelector('.save-icon') : null;
  
    // Validate required fields
    if (!trainingDatetimeInput || !trainingDatetimeInput.value) {
      UI.showToast("La data de l'assaig és obligatòria", "error");
      return;
    }
  
    const isEditing = !!APP.currentTrainingId;
    const trainingId = isEditing ? APP.currentTrainingId : trainingDatetimeInput.value;
  
    const training = {
      date: trainingId,
      description: trainingDescriptionInput ? trainingDescriptionInput.value : "",
    };

    if (isEditing && trainingDatetimeInput.value !== APP.currentTrainingId) {
      training.newDate = trainingDatetimeInput.value;
    }
  
    if (saveBtnTraining) {
      saveBtnTraining.disabled = true;
      saveBtnTraining.classList.add('saving');
    }
    if (saveIcon) {
      saveIcon.innerHTML = '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="32" stroke-dashoffset="32"><animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/></circle>';
    }
  
    API.saveTraining({ training })
      .then((response) => {
        if (saveBtnTraining) {
          saveBtnTraining.classList.remove('saving');
          saveBtnTraining.classList.add('success');
        }
        if (saveIcon) {
          saveIcon.innerHTML = '<polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>';
        }
  
        UI.showToast(response?.message || "Assaig desat correctament", "success");

        CACHE.saveTrainings({ trainings: null });
        
        if (response?.trainingId) {
          APP.currentTrainingId = response.trainingId;
        }
        TRAININGS.refreshPlanningTrainings();

        setTimeout(function () {
          if (saveBtnTraining) {
            saveBtnTraining.disabled = false;
            saveBtnTraining.classList.remove('success');
          }
          if (saveIcon) {
            saveIcon.innerHTML = '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>';
          }
        }, 2000);
      })
      .catch((error) => {
        if (saveBtnTraining) {
          saveBtnTraining.classList.remove('saving');
          saveBtnTraining.classList.add('error');
        }
        if (saveIcon) {
          saveIcon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>';
        }
        console.error("Error saving training:", error);
        UI.showToast(error || "Error desant l'assaig", "error");

        setTimeout(function () {
          if (saveBtnTraining) {
            saveBtnTraining.disabled = false;
            saveBtnTraining.classList.remove('error');
          }
          if (saveIcon) {
            saveIcon.innerHTML = '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>';
          }
        }, 3000);
      });
  }
  
  openDanceAudioDialog(danceName) {
    if (!danceName || typeof DANCES === "undefined") {
      return;
    }
  
    // Find the dance data
    const dance = DANCES.find((d) => d.name === danceName);
  
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
      UI.showDialogWithBackdrop(dialog);
      return;
    }
  
    // Create audio items
    dance.audios.forEach((audio) => {
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
      playButton.addEventListener("click", () => {
        playButton.style.display = "none";
  
        // Show loading state
        const loadingDiv = document.createElement("div");
        loadingDiv.className = "dance-audio-loading";
        loadingDiv.innerHTML = '<div class="spinner"></div><span>Carregant àudio...</span>';
        playerContainer.appendChild(loadingDiv);
  
        // Request audio data from API
        API.getAudioById({ audioId: audio.fileId })
        .then((result) => {
          loadingDiv.remove();
          if (result && result.audioData) {
            // Create audio element only on success
            const audioElement = document.createElement("audio");
            audioElement.controls = true;
            audioElement.style.width = "100%";
            audioElement.src = result.audioData;
            audioElement.addEventListener("play", () => {
              TRAININGS.pauseOtherAudiosInDialog(dialog, audioElement);
            });
            playerContainer.appendChild(audioElement);
          } else {
            const errorDiv = document.createElement("div");
            errorDiv.className = "dance-audio-error";
            errorDiv.textContent = "No s'ha pogut carregar l'àudio";
            playerContainer.appendChild(errorDiv);
          }
        })
        .catch((error) => {
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
    UI.showDialogWithBackdrop(dialog);
  }
  
  stopAllAudioInDialog(dialogElement) {
    if (!dialogElement) return;
    
    const audioElements = dialogElement.querySelectorAll("audio");
    audioElements.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  pauseOtherAudiosInDialog(dialogElement, currentAudio) {
    if (!dialogElement || !currentAudio) return;

    const audioElements = dialogElement.querySelectorAll("audio");
    audioElements.forEach((audio) => {
      if (audio !== currentAudio) {
        audio.pause();
      }
    });
  }
  
  closeDanceAudioDialog() {
    const dialog = document.getElementById("dance-audio-dialog");
    if (dialog && dialog.open) {
      this.stopAllAudioInDialog(dialog);
      UI.closeDialogWithBackdrop(dialog);
    }
  }
  
  navigateToTraining(trainingId) {
    if (!trainingId) return;
    APP.trainingIdToLoad = escapeHtml(trainingId);
    window.location.hash = "training/" + encodeURIComponent(trainingId);
  }
  
  confirmAttendance(trainingId) {
    this.handleAttendanceAction(trainingId, 'confirm');
  }
  
  
  cancelAttendance(trainingId) {
    this.handleAttendanceAction(trainingId, 'cancel');
  }
  
  
  confirmRelatedMemberAttendance(trainingId, memberId, memberAlias) {
    this.handleRelatedMemberAttendanceAction(trainingId, memberId, memberAlias, 'confirm');
  }
  
  cancelRelatedMemberAttendance(trainingId, memberId, memberAlias) {
    this.handleRelatedMemberAttendanceAction(trainingId, memberId, memberAlias, 'cancel');
  }
  
  
  handleRelatedMemberAttendanceAction(trainingId, memberId, memberAlias, action) {
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
    } else {
      apiCall = API.cancelRelatedMemberAttendance({ trainingId: trainingId, memberId: memberId, memberAlias: memberAlias });
    }
  
    apiCall
      .then((result) => {
        // Update the status indicator
        if (statusIndicator) {
          statusIndicator.className = 'training-status-indicator ' + result.status;
          if (result.status === 'confirmed') {
            statusIndicator.textContent = '✓ Confirmat';
          } else if (result.status === 'not-attending') {
            statusIndicator.textContent = '✗ No assistiré';
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
            button1Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="TRAININGS.cancelRelatedMemberAttendance('${escapedTrainingId}', '${escapedMemberId}', '${escapedMemberAlias}')" title="No assistiré">✗ No assistiré</button>`;
          } else if (result.status === 'not-attending') {
            button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="TRAININGS.confirmRelatedMemberAttendance('${escapedTrainingId}', '${escapedMemberId}', '${escapedMemberAlias}')" title="Confirmar assistència">✓ Confirmar</button>`;
          } else {
            button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="TRAININGS.confirmRelatedMemberAttendance('${escapedTrainingId}', '${escapedMemberId}', '${escapedMemberAlias}')" title="Confirmar assistència">✓ Confirmar</button>`;
            button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="TRAININGS.cancelRelatedMemberAttendance('${escapedTrainingId}', '${escapedMemberId}', '${escapedMemberAlias}')" title="No assistiré">✗ No assistiré</button>`;
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
            const noteLinkHtml = `<a href="javascript:void(0)" class="training-note-link" onclick="TRAININGS.openTrainingNoteDialog('${escapeHtml(trainingId)}', '${escapeHtml(memberId)}', '${escapeHtml(memberAlias)}', '${escapedMemberName}')">+ Afegir nota</a>`;
            const newLink = document.createElement('span');
            newLink.innerHTML = noteLinkHtml;
            if (statusIndicator) {
              statusIndicator.insertAdjacentElement('afterend', newLink.firstChild);
            } else {
              section.appendChild(newLink.firstChild);
            }
          }
        } else {
          if (existingNoteLink) {
            existingNoteLink.remove();
          }
        }
        
        UI.showToast(result.message || "Estat actualitzat", "success");
  
        // Update local training data
        if (memberAlias) {
          const trainings = CACHE.getTrainings() || [];
          const trainingIndex = trainings.findIndex(t => t.id === trainingId);
          if (trainingIndex !== -1) {
            const training = trainings[trainingIndex];
            if (!training.attendees) training.attendees = [];
            if (!training.rejections) training.rejections = [];
            
            // Remove member from both lists
            training.attendees = training.attendees.filter(a => a !== memberAlias);
            training.rejections = training.rejections.filter(r => r !== memberAlias);
            
            // Add member to the appropriate list based on new status
            if (result.status === 'confirmed') {
              training.attendees.push(memberAlias);
            } else if (result.status === 'not-attending') {
              training.rejections.push(memberAlias);
            }
            
            CACHE.saveTrainings({ trainings });
            
            // Update the count display
            const card = document.querySelector(`.training-card[data-training-id="${trainingId}"]`);
            if (card) {
              const countSpan = card.querySelector('.training-count');
              if (countSpan) {
                countSpan.textContent = training.attendees.length + ' persones apuntades';
              }
            }
          }
        }
      })
      .catch((error) => {
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
        UI.showToast(error.message || "Error actualitzant l'assistència", "error");
      });
  }
  
  handleAttendanceAction(trainingId, action) {
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
    } else {
      apiCall = API.cancelTrainingAttendance({ trainingId: trainingId });
    }
  
    apiCall
      .then((result) => {
        // Update the status indicator
        if (statusIndicator) {
          statusIndicator.className = 'training-status-indicator ' + result.status;
          if (result.status === 'confirmed') {
            statusIndicator.textContent = '✓ Confirmat';
          } else if (result.status === 'not-attending') {
            statusIndicator.textContent = '✗ No assistiré';
          } else {
            statusIndicator.textContent = '? No confirmat';
          }
        }
        
        // Update the buttons based on new status
        if (buttonsContainer) {
          let button1Html = '';
          let button2Html = '';
          
          if (result.status === 'confirmed') {
            button1Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="TRAININGS.cancelAttendance('${escapeHtml(trainingId)}')" title="No assistiré">✗ No assistiré</button>`;
          } else if (result.status === 'not-attending') {
            button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="TRAININGS.confirmAttendance('${escapeHtml(trainingId)}')" title="Confirmar assistència">✓ Confirmar</button>`;
          } else {
            button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="TRAININGS.confirmAttendance('${escapeHtml(trainingId)}')" title="Confirmar assistència">✓ Confirmar</button>`;
            button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="TRAININGS.cancelAttendance('${escapeHtml(trainingId)}')" title="No assistiré">✗ No assistiré</button>`;
          }
          
          buttonsContainer.innerHTML = button1Html + button2Html;
        }
        
        // Update note link visibility
        let existingNoteLink = section.querySelector('.training-note-link');
        if (result.status === 'confirmed' || result.status === 'not-attending') {
          if (!existingNoteLink) {
            const noteLinkHtml = `<a href="javascript:void(0)" class="training-note-link" onclick="TRAININGS.openTrainingNoteDialog('${escapeHtml(trainingId)}', '', '', '')">+ Afegir nota</a>`;
            const newLink = document.createElement('span');
            newLink.innerHTML = noteLinkHtml;
            if (statusIndicator) {
              statusIndicator.insertAdjacentElement('afterend', newLink.firstChild);
            } else {
              section.appendChild(newLink.firstChild);
            }
          }
        } else {
          if (existingNoteLink) {
            existingNoteLink.remove();
          }
        }
        
        UI.showToast(result.message || "Estat actualitzat", "success");
  
        // Update local training data
        var userAlias = APP.currentUser ? APP.currentUser.alias : null;
        if (userAlias) {
          const trainings = CACHE.getTrainings() || [];
          const trainingIndex = trainings.findIndex(t => t.id === trainingId);
          if (trainingIndex !== -1) {
            const training = trainings[trainingIndex];
            if (!training.attendees) training.attendees = [];
            if (!training.rejections) training.rejections = [];
            
            // Remove user from both lists
            training.attendees = training.attendees.filter(a => a !== userAlias);
            training.rejections = training.rejections.filter(r => r !== userAlias);
            
            // Add user to the appropriate list based on new status
            if (result.status === 'confirmed') {
              training.attendees.push(userAlias);
            } else if (result.status === 'not-attending') {
              training.rejections.push(userAlias);
            }
            
            CACHE.saveTrainings({ trainings });
            
            // Update the count display
            const card = document.querySelector(`.training-card[data-training-id="${trainingId}"]`);
            if (card) {
              const countSpan = card.querySelector('.training-count');
              if (countSpan) {
                countSpan.textContent = training.attendees.length + ' persones apuntades';
              }
            }
          }
        }
      })
      .catch((error) => {
        console.error("Error updating attendance:", error);
        // Restore original state on error
        if (statusIndicator && originalStatusHtml) {
          statusIndicator.outerHTML = originalStatusHtml;
        }
        if (buttonsContainer) {
          buttonsContainer.innerHTML = originalButtonsHtml;
        }
        UI.showToast(error || "Error actualitzant l'assistència", "error");
      });
  }
  
  
  renderPlanningTrainingsList(trainings) {
    const container = document.getElementById("planning-training-list");
    const pastTrainingsContainer = document.getElementById("past-training-list");
    const pastTrainingsToggle = document.getElementById("past-training-toggle");
    const pastTrainingsCount = document.getElementById("past-training-count");
  
    if (!container) return;
  
    if (!trainings || trainings.length === 0) {
      container.innerHTML = `
      <div class="trainings-empty">
      <div class="trainings-empty-icon">📅</div>
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
    trainings.forEach((training) => {
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
  
    // Helper to create training card HTML
    const createTrainingCardHTML = (training, isPast = false) => {
      const formattedDate = EVENTS.formatEventDate(training.date);
      let meetingPlaceHtml = "";
      if (training.meetingPlace) {
        meetingPlaceHtml = `<span class="training-card-location">📍 ${escapeHtml(training.meetingPlace)}</span>`;
      }
      
      // For past trainings, show attendance indicator
      let attendanceIndicatorHtml = "";
      if (isPast && APP.currentUser) {
        const relatedMembers = APP.currentUser.relatedMembers || [];
        const hasRelatedMembers = relatedMembers.length > 0;
        
        const generateAttendanceSection = (memberAlias, memberName, isRelatedMember, showName) => {
          const isAttending = (training.attendees || []).some(function(attendee) {
            return attendee === memberAlias;
          });
          const memberNote = (training.notes || {})[memberAlias];
          const noteHtml = memberNote ? `<span class="training-attendance-note" title="${escapeHtml(memberNote)}">📝 «${escapeHtml(memberNote)}»</span>` : '';
          
          const sectionClass = isRelatedMember ? 'training-confirmation-section related-member past' : 'training-confirmation-section past';
          let statusClass = '';
          let statusText = '';
          
          if (isAttending) {
            statusClass = 'training-status-indicator confirmed';
            statusText = `✓ ${isRelatedMember ? 'Ha assistit' : 'Has assistit'}`;
          } else {
            statusClass = 'training-status-indicator not-attending';
            statusText = `✗ ${isRelatedMember ? 'No ha assistit' : 'No has assistit'}`;
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
        
        // Helper to generate confirmation section HTML for a member
        const generateConfirmationSection = (memberId, memberAlias, memberName, isRelatedMember, showName) => {
          const isConfirmed = (training.attendees || []).some(function(attendee) {
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
            `TRAININGS.confirmRelatedMemberAttendance('${escapeHtml(training.id)}', '${escapeHtml(memberId)}', '${escapeHtml(memberAlias)}')` : 
            `TRAININGS.confirmAttendance('${escapeHtml(training.id)}')`;
          const cancelFn = isRelatedMember ? 
            `TRAININGS.cancelRelatedMemberAttendance('${escapeHtml(training.id)}', '${escapeHtml(memberId)}', '${escapeHtml(memberAlias)}')` : 
            `TRAININGS.cancelAttendance('${escapeHtml(training.id)}')`;
          const openNoteFn = isRelatedMember ?
            `TRAININGS.openTrainingNoteDialog('${escapeHtml(training.id)}', '${escapeHtml(memberId)}', '${escapeHtml(memberAlias)}', '${escapeHtml(memberName)}')` :
            `TRAININGS.openTrainingNoteDialog('${escapeHtml(training.id)}', '', '', '')`;
          
          const notAttendingText = isRelatedMember ? 'No assistiré' : 'No assistiré';
          const notAttendingTitle = isRelatedMember ? 'No assistiré' : 'No assistiré';
          
          if (isConfirmed) {
            statusClass = 'training-status-indicator confirmed';
            statusText = '✓\uFE0E Confirmat';
            button1Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="event.stopPropagation(); ${cancelFn}" title="${notAttendingTitle}">✗ ${notAttendingText}</button>`;
            noteLinkHtml = memberNote ? 
              `<a href="javascript:void(0)" class="training-note-link has-note" onclick="event.stopPropagation(); ${openNoteFn}" title="Editar nota">📝 «${escapeHtml(memberNote)}»</a>` :
              `<a href="javascript:void(0)" class="training-note-link" onclick="event.stopPropagation(); ${openNoteFn}">+ Afegir nota</a>`;
          } else if (isRejected) {
            statusClass = 'training-status-indicator not-attending';
            statusText = `✗\uFE0E ${notAttendingText}`;
            button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="event.stopPropagation(); ${confirmFn}" title="Confirmar assistència">✓ Confirmar</button>`;
            noteLinkHtml = memberNote ? 
              `<a href="javascript:void(0)" class="training-note-link has-note" onclick="event.stopPropagation(); ${openNoteFn}" title="Editar nota">📝 «${escapeHtml(memberNote)}»</a>` :
              `<a href="javascript:void(0)" class="training-note-link" onclick="event.stopPropagation(); ${openNoteFn}">+ Afegir nota</a>`;
          } else {
            button1Html = `<button type="button" class="btn btn-xs btn-outline-success" onclick="event.stopPropagation(); ${confirmFn}" title="Confirmar assistència">✓ Confirmar</button>`;
            button2Html = `<button type="button" class="btn btn-xs btn-outline-danger" onclick="event.stopPropagation(); ${cancelFn}" title="${notAttendingTitle}">✗ ${notAttendingText}</button>`;
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
              ${noteLinkHtml}
              <div class="training-confirmation-buttons">
                ${button1Html}
                ${button2Html}
              </div>
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
      
      return `
  <div class="training-card" data-training-id="${training.id}" onclick="TRAININGS.navigateToTraining('${escapeHtml(training.id)}')">
  <div class="training-card-info">
      <span class="training-card-name">${escapeHtml(training.name)}</span>
      <span class="training-card-date">${formattedDate}</span>
      <span class="training-count">${training.attendees ? training.attendees.length : 0} persones apuntades</span>
      ${meetingPlaceHtml}
      ${attendanceIndicatorHtml}
      ${confirmationStatusHtml}
  </div>
  </div>
  `;
    }
  
    // Render upcoming trainings
    if (upcomingTrainings.length === 0) {
      container.innerHTML = `
  <div class="trainings-empty">
  <div class="trainings-empty-icon">📅</div>
  <p>No hi ha assajos programats</p>
  <p>Crea un nou assaig per començar!</p>
  </div>
  `;
    } else {
      // Sort upcoming trainings by date descending (newer/furthest future first)
      upcomingTrainings.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
  
      const upcomingHTML = upcomingTrainings.map((t) => createTrainingCardHTML(t, false)).join("");
      container.innerHTML = upcomingHTML;
    }
  
    // Render past trainings in collapsible
    if (pastTrainingsContainer) {
      if (pastTrainings.length === 0) {
        pastTrainingsContainer.innerHTML = '<div class="past-training-empty">No hi ha assajos passats</div>';
      } else {
        // Sort past trainings by date descending (newest/most recent first)
        pastTrainings.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB - dateA;
        });
        const pastHTML = pastTrainings.map((t) => createTrainingCardHTML(t, true)).join("");
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
      pastTrainingsToggle.addEventListener("click", () => {
        const content = pastTrainingsContainer;
        pastTrainingsToggle.classList.toggle("active");
        if (content.style.display === "none") {
          content.style.display = "";
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
  
  
  refreshPlanningTrainings() {
    const refreshBtn = document.getElementById("refresh-training-btn");
  
    if (refreshBtn) {
      refreshBtn.classList.add("refreshing");
      refreshBtn.disabled = true;
    }
  
    API.getTrainings({ forceRefresh: true })
      .then((trainings) => {
        if (refreshBtn) {
          refreshBtn.classList.remove("refreshing");
          refreshBtn.disabled = false;
        }
        TRAININGS.renderPlanningTrainingsList(trainings);
        UI.showToast("Llista actualitzada", "success");
      })
      .catch((error) => {
        if (refreshBtn) {
          refreshBtn.classList.remove("refreshing");
          refreshBtn.disabled = false;
        }
        UI.showToast("Error actualitzant la llista", "error");
      });
  }
  
  
  resetTrainingForm() {
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
    TRAININGS.updateTrainingPageTitle(false);
  
    // Apply editable state (admin-only)
    TRAININGS.applyTrainingEditableState();
  
    // Initialize form event listeners for dance detection
    TRAININGS.initializeTrainingFormListeners();
  }
  
  loadPlanningTrainingData() {
    const container = document.getElementById("planning-training-list");
    if (!container) return;
  
    // Show loading state
    container.innerHTML = `
          <div class="training-loading">
          <div class="spinner"></div>
          <span>Carregant assajos...</span>
          </div>
      `;
  
    API.getTrainings({ onBackgroundUpdate: (trainings) => TRAININGS.renderPlanningTrainingsList(trainings) })
      .then((events) => {
        TRAININGS.renderPlanningTrainingsList(events);
      })
      .catch((error) => {
        console.error("Failed to load training sessions:", error);
        container.innerHTML = `
                  <div class="training-empty">
                  <div class="training-empty-icon">📅</div>
                  <p>No s'han pogut carregar els assajos</p>
                  </div>
              `;
        
        const refreshBtn = document.getElementById("refresh-training-btn");
        if (refreshBtn) {
          refreshBtn.style.display = "block";
        }
      });
  }

  openTrainingNoteDialog(trainingId, memberId, memberAlias, memberName) {
    var dialog = document.getElementById('training-note-dialog');
    var noteInput = document.getElementById('training-note-input');
    var memberNameSpan = document.getElementById('training-note-member-name');
    var charCount = document.getElementById('training-note-char-current');
    
    if (!dialog || !noteInput) return;
    
    trainingNoteDialogState = { trainingId, memberId, memberAlias, memberName };
    
    if (memberNameSpan) {
      memberNameSpan.textContent = memberName || '';
      memberNameSpan.style.display = memberName ? '' : 'none';
    }
    
    var trainings = CACHE.getTrainings() || [];
    var training = trainings.find(function(t) { return t.id === trainingId; });
    var alias = memberAlias || (APP.currentUser ? APP.currentUser.alias : '');
    var existingNote = training && training.notes ? (training.notes[alias] || '') : '';
    
    noteInput.value = existingNote;
    if (charCount) charCount.textContent = existingNote.length;
    
    noteInput.oninput = function() {
      if (charCount) charCount.textContent = noteInput.value.length;
    };
    
    UI.showDialogWithBackdrop(dialog);
    noteInput.focus();
  }
  
  closeTrainingNoteDialog() {
    var dialog = document.getElementById('training-note-dialog');
    if (dialog && dialog.open) {
      UI.closeDialogWithBackdrop(dialog);
    }
    trainingNoteDialogState = { trainingId: null, memberId: null, memberAlias: null, memberName: null };
  }
  
  saveTrainingNote() {
    var noteInput = document.getElementById('training-note-input');
    var saveBtn = document.getElementById('training-note-save-btn');
    var btnText = saveBtn ? saveBtn.querySelector('.btn-text') : null;
    var btnLoading = saveBtn ? saveBtn.querySelector('.btn-loading') : null;
    
    if (!noteInput) return;
    
    var note = noteInput.value.trim();
    var state = trainingNoteDialogState;
    var trainingId = state.trainingId;
    var memberId = state.memberId;
    var memberAlias = state.memberAlias;
    
    if (!trainingId) {
      UI.showToast('Error: no s\'ha pogut identificar l\'assaig', 'error');
      return;
    }
    
    if (saveBtn) saveBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'inline';
    
    var apiCall;
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
        UI.showToast(result.message || 'Nota desada', 'success');
        
        var alias = memberAlias || (APP.currentUser ? APP.currentUser.alias : '');
        var trainings = CACHE.getTrainings() || [];
        var trainingIndex = trainings.findIndex(function(t) { return t.id === trainingId; });
        if (trainingIndex !== -1) {
          if (!trainings[trainingIndex].notes) trainings[trainingIndex].notes = {};
          if (note) {
            trainings[trainingIndex].notes[alias] = note;
          } else {
            delete trainings[trainingIndex].notes[alias];
          }
          CACHE.saveTrainings({ trainings });
        }
        
        TRAININGS.updateNoteLinkInUI(trainingId, memberId, memberAlias, note);
        TRAININGS.closeTrainingNoteDialog();
      })
      .catch(function(error) {
        if (saveBtn) saveBtn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnLoading) btnLoading.style.display = 'none';
        UI.showToast(error || 'Error desant la nota', 'error');
      });
  }
  
  updateNoteLinkInUI(trainingId, memberId, note) {
    var section;
    if (memberId) {
      section = document.querySelector(`.training-confirmation-section[data-training-id="${trainingId}"][data-member-id="${memberId}"]`);
    } else {
      section = document.querySelector(`.training-confirmation-section[data-training-id="${trainingId}"]:not([data-member-id])`);
    }
    
    if (!section) return;
    
    var existingLink = section.querySelector('.training-note-link');
    if (existingLink) {
      if (note) {
        existingLink.className = 'training-note-link has-note';
        existingLink.textContent = '📝 «' + note + '»';
        existingLink.title = 'Editar nota';
      } else {
        existingLink.className = 'training-note-link';
        existingLink.textContent = '+ Afegir nota';
        existingLink.title = '';
      }
    }
  }
  
  initializeTrainingNoteDialogListeners() {
    var closeBtn = document.getElementById('training-note-close-btn');
    var cancelBtn = document.getElementById('training-note-cancel-btn');
    var saveBtn = document.getElementById('training-note-save-btn');
    var self = this;
    
    if (closeBtn && !closeBtn.dataset.initialized) {
      closeBtn.addEventListener('click', function() { self.closeTrainingNoteDialog(); });
      closeBtn.dataset.initialized = 'true';
    }
    
    if (cancelBtn && !cancelBtn.dataset.initialized) {
      cancelBtn.addEventListener('click', function() { self.closeTrainingNoteDialog(); });
      cancelBtn.dataset.initialized = 'true';
    }
    
    if (saveBtn && !saveBtn.dataset.initialized) {
      saveBtn.addEventListener('click', function() { self.saveTrainingNote(); });
      saveBtn.dataset.initialized = 'true';
    }
  }
})();



var trainingNoteDialogState = {
  trainingId: null,
  memberId: null,
  memberAlias: null,
  memberName: null
};



function checkIfTrainingIsEditable() {
    if (isTrainingManuallyUnlocked) {
        return true;
    }

    const trainingDatetimeInput = document.getElementById('training-datetime-input');
    if (!trainingDatetimeInput || !trainingDatetimeInput.value) {
        return true;
    }
    const trainingDate = new Date(trainingDatetimeInput.value);
    const now = new Date();
    isTrainingEditable = trainingDate >= now;
    return isTrainingEditable;
}