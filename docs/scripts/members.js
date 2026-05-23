const MEMBERS = new (class AppMembers {
  POSITION_OK = 'SI';
  POSITION_IN_PROGRESS = 'EN PROGRES';
  constructor() {
    // Current member being edited inline
    this.currentEditingMemberId = null;
    this.originalMemberData = null;
    this.isAddingNewMember = false;
    this.membersData = [];
    this._saveVersion = 0;
    this.membersSortColumn = "active";
    this.membersSortDirection = "desc";
    this.membersTypeFilterValue = "";
    this.membersActiveFilterValue = ""; // '', 'true', 'false'
    this.membersRolsFilterValue = ""; // '', 'ADMIN', 'NO_ADMIN'
    this.membersAccessFilterValue = ""; // '', 'HAS_ACCESS', 'NO_ACCESS'
    this.allOriginalMemberData = null;
    this.isEditingAllMembers = false;
    this.passwordChangeMemberEmail = null;

    const addMemberBtn = document.getElementById("add-member-btn");
    if (addMemberBtn) {
      addMemberBtn.addEventListener("click", () => this._startAddNewMember());
    }

    const refreshMembersBtn = document.getElementById("refresh-members-btn");
    if (refreshMembersBtn) {
      refreshMembersBtn.addEventListener("click", () => this._refreshMembersList());
    }

    const sendCommunicationBtn = document.getElementById("send-communication-btn");
    if (sendCommunicationBtn) {
      sendCommunicationBtn.addEventListener("click", () => this._openCommunicationDialog());
    }

    document.addEventListener("click", (e) => {
      const positionsBtn = e.target.closest(".btn-member-positions");
      if (positionsBtn) {
        e.preventDefault();
        e.stopPropagation();
        const alias = positionsBtn.getAttribute("data-member-alias");
        if (alias) {
          NAVIGATION.navigateTo(`member-positions/${encodeURIComponent(alias)}`);
        }
        return;
      }

      const btn = e.target.closest(".btn-change-password");
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const email = btn.getAttribute("data-member-email");
        const name = btn.getAttribute("data-member-name");
        if (email) {
          this._openPasswordDialog(email, name);
        }
      }
    });
  }

  _startAddNewMember() {
    // Cancel any existing edit
    if (this.currentEditingMemberId) {
      this._cancelInlineEdit();
    }

    // Set flag for new member mode
    this.isAddingNewMember = true;

    // Create a temporary member object
    const newMember = {
      id: "__new__",
      name: "",
      email: "",
      type: "ADULT",
      roles: [],
      relations: [],
    };

    this.currentEditingMemberId = "__new__";
    this.originalMemberData = null;

    // Add temporary member to data array at the beginning
    this.membersData.unshift(newMember);

    // Show action bar with different text
    const actionsBar = document.getElementById("members-edit-actions");
    const editInfo = actionsBar.querySelector(".edit-info");
    if (actionsBar) {
      actionsBar.style.display = "flex";
      if (editInfo) editInfo.textContent = "Afegint nou membre...";
    }

    // Re-render table to show editable row
    this._renderMembersTable();

    // Focus on name input
    const nameInput = document.querySelector('input[name="inline-name"]');
    if (nameInput) nameInput.focus();

    // Initialize action bar listeners
    this._initInlineEditListeners();
  }

  _cancelInlineEdit() {
    // If adding a new member, remove the temporary entry
    if (this.isAddingNewMember) {
      this.membersData = this.membersData.filter((m) => {
        return m.id !== "__new__";
      });
      this.isAddingNewMember = false;
    }

    // If editing all members, restore all original data
    if (this.isEditingAllMembers && this.allOriginalMemberData) {
      this.membersData = this.allOriginalMemberData;
    }

    this.allOriginalMemberData = null;
    this.isEditingAllMembers = false;

    this.currentEditingMemberId = null;
    this.originalMemberData = null;

    // Hide action bar and restore text
    const actionsBar = document.getElementById("members-edit-actions");
    const editInfo = actionsBar?.querySelector(".edit-info");
    if (actionsBar) {
      actionsBar.style.display = "none";
      if (editInfo) editInfo.textContent = "Editant membres...";
    }

    // Show edit button again
    const editAllBtn = document.getElementById("edit-all-members-btn");
    if (editAllBtn) editAllBtn.style.display = "";

    // Hide Active column
    document.querySelectorAll(".active-column").forEach((el) => {
      el.style.display = "none";
    });

    // Re-render table
    this._renderMembersTable();
  }

  _renderMembersTable() {
    const tbody = document.querySelector("#members-table tbody");
    if (!tbody) return;

    const searchValue = (
      document.getElementById("members-search")?.value || ""
    ).toLowerCase();
    const typeFilter = this.membersTypeFilterValue || "";
    const rolsFilter = this.membersRolsFilterValue || "";

    // Filter
    const filtered = this.membersData.filter((member) => {
      const matchesSearch =
        !searchValue ||
        (member.alias || "").toLowerCase().includes(searchValue) ||
        (member.name || "").toLowerCase().includes(searchValue) ||
        (member.email || "").toLowerCase().includes(searchValue) ||
        (member.relatedMembers || [])
          .map((m) => m.alias || m.name || "")
          .join(" ").toLowerCase().includes(searchValue);
      const matchesType = !typeFilter || member.type === typeFilter;
      const matchesActive =
        !this.membersActiveFilterValue ||
        (this.membersActiveFilterValue === "true" && member.active !== false) ||
        (this.membersActiveFilterValue === "false" && member.active === false);

      // Rols filter
      let matchesRols = true;
      if (rolsFilter === "ADMIN") {
        matchesRols = (member.roles || []).includes("ADMIN");
      } else if (rolsFilter === "NO_ADMIN") {
        matchesRols = !(member.roles || []).includes("ADMIN");
      }

      // Access filter (Relations)
      let matchesAccess = true;
      const accessFilter = this.membersAccessFilterValue || "";
      if (accessFilter === "HAS_ACCESS") {
        matchesAccess = (member.relatedMembers || []).length > 0;
      } else if (accessFilter === "NO_ACCESS") {
        matchesAccess = (member.relatedMembers || []).length === 0;
      }

      return (
        matchesSearch &&
        matchesType &&
        matchesActive &&
        matchesRols &&
        matchesAccess
      );
    });

    // Sort
    filtered.sort((a, b) => {
      var valA, valB;
      switch (this.membersSortColumn) {
        case "active":
          valA = a.active !== false ? 1 : 0;
          valB = b.active !== false ? 1 : 0;
          break;
        case "type":
          valA = a.type || "";
          valB = b.type || "";
          break;
        case "name":
          valA = (a.name || "").toLowerCase();
          valB = (b.name || "").toLowerCase();
          break;
        case "email":
          valA = (a.email || "").toLowerCase();
          valB = (b.email || "").toLowerCase();
          break;
        default:
          valA = "";
          valB = "";
      }
      if (valA < valB) return this.membersSortDirection === "asc" ? -1 : 1;
      if (valA > valB) return this.membersSortDirection === "asc" ? 1 : -1;
      return 0;
    });

    // Render
    tbody.innerHTML = "";
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9">No s\'han trobat membres</td></tr>';
      return;
    }
    filtered.forEach((member) => {
      const tr = document.createElement("tr");
      tr.classList.add("clickable-row");
      tr.setAttribute("data-member-id", member.id);
      const isEditing =
        String(this.currentEditingMemberId) === String(member.id) || this.isEditingAllMembers;

      if (isEditing) {
        tr.classList.add("editing-row");
        tr.innerHTML = this._renderEditableRow(member);
      } else {
        const typeLabel =
          member.type === "ADULT"
            ? "Adult"
            : member.type === "KID"
              ? "Xiquet/a"
              : "";
        const rolesHtml =
          (member.roles || [])
            .map(function (role) {
              return `<span class="role">${role}</span>`;
            })
            .join("") || "-";
        const nameStyle =
          member.active === false ? "text-decoration: line-through;" : "";
        const showPasswordBtn = member.type === "ADULT" && member.email;
        const memberAlias = (member.alias || member.name || "").trim();
        const activeIndicator = member.active !== false ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #4caf50;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #999;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        const memberPositionsBtnHtml = memberAlias
          ? `
        <button type="button" class="btn-member-positions" title="Veure posicions" data-member-alias="${escapeHtml(memberAlias)}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" style="vertical-align: middle;">
            <rect x="4" y="4" width="7" height="7"></rect>
            <rect x="13" y="4" width="7" height="7"></rect>
            <rect x="4" y="13" width="7" height="7"></rect>
            <rect x="13" y="13" width="7" height="7"></rect>
          </svg>
        </button>`
          : "";
        const passwordBtnHtml = showPasswordBtn
          ? `
        <button type="button" class="btn-change-password" title="Canviar contrasenya" data-member-id="${member.id}" data-member-name="${member.alias}" data-member-email="${member.email}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" style="vertical-align: middle;">
            <path
              d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4">
            </path>
          </svg>
        </button>`
          : "";
        tr.innerHTML = `
        <td style="${nameStyle}">${member.alias || ""}</td>
        <td>${member.email || ""}</td>
        <td class="type-${(member.type || "").toLowerCase()}">${typeLabel}</td>
        <td>${rolesHtml}</td>
        <td>${(member.relatedMembers || []).map(rm => rm.alias || rm.name || "").join(", ") || "-"}</td>
        <td class="active-column" style="display: none;"></td>
        <td style="text-align: center;">${activeIndicator}</td>
        <td style="text-align: center;">${passwordBtnHtml}</td>
        <td style="text-align: center;">${memberPositionsBtnHtml}</td>
        `;
      }
      tbody.appendChild(tr);
    });

    // Initialize long tap listeners on table rows
    this._initMembersTableLongTap();
  }

  _initInlineEditListeners() {
    const discardBtn = document.getElementById("members-edit-discard");
    const applyBtn = document.getElementById("members-edit-apply");

    if (discardBtn && !discardBtn.dataset.initialized) {
      discardBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this._cancelInlineEdit();
      });
      discardBtn.dataset.initialized = "true";
    }

    if (applyBtn && !applyBtn.dataset.initialized) {
      applyBtn.addEventListener("click", () => this._applyInlineEdit());
      applyBtn.dataset.initialized = "true";
    }
  }

  _initMembersTableLongTap() {
    const rows = document.querySelectorAll("#members-table tbody tr.clickable-row");

    rows.forEach((row) => {
      // Skip if already initialized
      if (row.dataset.longtapInitialized) {
        return;
      }

      let longPressTimer = null;
      let hasMovedDuringPress = false;
      const longPressDuration = 500; // milliseconds

      const startLongPress = () => {
        hasMovedDuringPress = false;
        longPressTimer = setTimeout(() => {
          const memberId = row.getAttribute("data-member-id");
          if (memberId) {
            this._startInlineEdit(memberId);
          }
        }, longPressDuration);
      };

      const cancelLongPress = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }

      // Touch events for mobile
      row.addEventListener("touchstart", () => {
        startLongPress();
      }, { passive: true });

      row.addEventListener("touchmove", () => {
        hasMovedDuringPress = true;
        cancelLongPress();
      }, { passive: true });

      row.addEventListener("touchend", () => {
        cancelLongPress();
      });

      row.addEventListener("touchcancel", () => {
        cancelLongPress();
      });

      // Mouse events for desktop
      row.addEventListener("mousedown", () => {
        startLongPress();
      });

      row.addEventListener("mouseup", () => {
        cancelLongPress();
      });

      row.addEventListener("mouseleave", () => {
        cancelLongPress();
      });

      row.addEventListener("mousemove", () => {
        if (longPressTimer) {
          cancelLongPress();
        }
      });

      row.dataset.longtapInitialized = "true";
    });
  }

  _refreshMembersList() {
    const refreshBtn = document.getElementById("refresh-members-btn");

    // Add spinning animation
    if (refreshBtn) {
      refreshBtn.classList.add("refreshing");
      refreshBtn.disabled = true;
    }

    // Show loading state in the table
    const tbody = document.querySelector("#members-table tbody");
    if (tbody)
      tbody.innerHTML = '<tr><td colspan="9">Actualitzant membres...</td></tr>';

    API.getMembers({ forceRefresh: true })
      .then((members) => {
        // Remove spinning animation
        if (refreshBtn) {
          refreshBtn.classList.remove("refreshing");
          refreshBtn.disabled = false;
        }

        if (!Array.isArray(members)) {
          tbody.innerHTML =
            '<tr><td colspan="9">No s\'ha pogut carregar la llista de membres</td></tr>';
          return;
        }
        MEMBERS.membersData = members;
        this._renderMembersTable();
        UI.showToast("Llista actualitzada", "success");
      })
      .catch((error) => {
        // Remove spinning animation
        if (refreshBtn) {
          refreshBtn.classList.remove("refreshing");
          refreshBtn.disabled = false;
        }
        console.error("Error refreshing members:", error);
        tbody.innerHTML =
          '<tr><td colspan="9">No s\'ha pogut carregar la llista de membres</td></tr>';
        UI.showToast("Error actualitzant la llista", "error");
      });
  }

  _initMembersFilters() {
    const searchInput = document.getElementById("members-search");
    const sortableHeaders = document.querySelectorAll(
      "#members-table th.sortable",
    );

    // Remove existing listeners by cloning and replacing
    if (searchInput && !searchInput.dataset.initialized) {
      searchInput.addEventListener("input", () => MEMBERS._renderMembersTable());
      searchInput.dataset.initialized = "true";
    }
    sortableHeaders.forEach((th) => {
      if (!th.dataset.initialized) {
        th.addEventListener("click", () => {
          const column = th.getAttribute("data-sort");
          if (MEMBERS.membersSortColumn === column) {
            MEMBERS.membersSortDirection =
              MEMBERS.membersSortDirection === "asc" ? "desc" : "asc";
          } else {
            MEMBERS.membersSortColumn = column;
            MEMBERS.membersSortDirection = "asc";
          }
          MEMBERS._updateSortIcons();
          MEMBERS._renderMembersTable();
        });
        th.dataset.initialized = "true";
      }
    });
    MEMBERS._updateSortIcons();

    // Long press on Type header to show filter dropdown
    const typeHeader = document.querySelector(
      '#members-table th[data-sort="type"]',
    );
    if (typeHeader && !typeHeader.dataset.longpressInitialized) {
      let longPressTimer = null;
      let longPressTriggered = false;
      const longPressDuration = 500; // ms

      function showTypeFilterDropdown(e) {
        e.preventDefault();
        e.stopPropagation();
        longPressTriggered = true;

        // Remove any existing dropdown
        const existingDropdown = document.getElementById("type-filter-dropdown");
        if (existingDropdown) existingDropdown.remove();

        // Create dropdown
        const dropdown = document.createElement("div");
        dropdown.id = "type-filter-dropdown";
        dropdown.className = "type-filter-dropdown";
        dropdown.innerHTML = `
  <div class="type-filter-option" data-value="">Tots els tipus</div>
  <div class="type-filter-option" data-value="ADULT">Adult</div>
  <div class="type-filter-option" data-value="KID">Xiquet/a</div>
  `;

        // Position dropdown below the header
        const rect = typeHeader.getBoundingClientRect();
        dropdown.style.top = rect.bottom + window.scrollY + "px";
        dropdown.style.left = rect.left + "px";

        // Mark current selection and add click handlers
        dropdown.querySelectorAll(".type-filter-option").forEach((opt) => {
          if (opt.getAttribute("data-value") === MEMBERS.membersTypeFilterValue) {
            opt.classList.add("selected");
          }
          opt.addEventListener("click", () => {
            MEMBERS.membersTypeFilterValue = opt.getAttribute("data-value");
            dropdown.remove();
            MEMBERS._renderMembersTable();
          });
        });

        document.body.appendChild(dropdown);

        // Close on click outside
        function closeDropdown(event) {
          if (!dropdown.contains(event.target)) {
            dropdown.remove();
            document.removeEventListener("click", closeDropdown);
          }
        }
        setTimeout(function () {
          document.addEventListener("click", closeDropdown);
        }, 0);
      }

      function startLongPress(e) {
        longPressTriggered = false;
        longPressTimer = setTimeout(function () {
          showTypeFilterDropdown(e);
        }, longPressDuration);
      }

      function cancelLongPress() {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }

      // Prevent click from sorting when long press was triggered
      typeHeader.addEventListener(
        "click",
        function (e) {
          if (longPressTriggered) {
            e.stopImmediatePropagation();
            longPressTriggered = false;
          }
        },
        true,
      );

      // Mouse events
      typeHeader.addEventListener("mousedown", startLongPress);
      typeHeader.addEventListener("mouseup", cancelLongPress);
      typeHeader.addEventListener("mouseleave", cancelLongPress);

      // Touch events for mobile
      typeHeader.addEventListener("touchstart", startLongPress, {
        passive: true,
      });
      typeHeader.addEventListener("touchend", cancelLongPress);
      typeHeader.addEventListener("touchcancel", cancelLongPress);
      typeHeader.addEventListener("touchmove", cancelLongPress);

      // Prevent context menu on long press
      typeHeader.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        showTypeFilterDropdown(e);
      });

      typeHeader.dataset.longpressInitialized = "true";
    }

    // Click on last column header to show Active filter dropdown
    const activeHeader = document.getElementById("active-filter-header");
    if (activeHeader && !activeHeader.dataset.initialized) {
      activeHeader.style.cursor = "pointer";

      activeHeader.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        // Remove any existing dropdown
        const existingDropdown = document.getElementById(
          "active-filter-dropdown",
        );
        if (existingDropdown) {
          existingDropdown.remove();
          return; // Toggle off if already open
        }

        // Create dropdown
        const dropdown = document.createElement("div");
        dropdown.id = "active-filter-dropdown";
        dropdown.className = "type-filter-dropdown";
        dropdown.innerHTML = `
        <div class="type-filter-option" data-value="">Tots</div>
        <div class="type-filter-option" data-value="true">En actiu</div>
        <div class="type-filter-option" data-value="false">No actiu</div>
        `;

        // Position dropdown below the header
        const rect = activeHeader.getBoundingClientRect();
        dropdown.style.top = rect.bottom + window.scrollY + "px";
        dropdown.style.left = rect.right - 160 + "px"; // Align to right edge

        // Mark current selection and add click handlers
        dropdown.querySelectorAll(".type-filter-option").forEach((opt) => {
          if (opt.getAttribute("data-value") === MEMBERS.membersActiveFilterValue) {
            opt.classList.add("selected");
          }
          opt.addEventListener("click", () => {
            MEMBERS.membersActiveFilterValue = opt.getAttribute("data-value");
            dropdown.remove();
            MEMBERS._renderMembersTable();
          });
        });

        document.body.appendChild(dropdown);

        // Close on click outside
        function closeDropdown(event) {
          if (!dropdown.contains(event.target) && event.target !== activeHeader) {
            dropdown.remove();
            document.removeEventListener("click", closeDropdown);
          }
        }
        setTimeout(function () {
          document.addEventListener("click", closeDropdown);
        }, 0);
      });

      activeHeader.dataset.initialized = "true";
    }
  }

  _applyAllMembersEdit() {
    const applyBtn = document.getElementById("members-edit-apply");
    const btnText = applyBtn.querySelector(".btn-text");
    const btnLoading = applyBtn.querySelector(".btn-loading");

    // Show loading state
    btnText.style.display = "none";
    btnLoading.style.display = "inline";
    applyBtn.disabled = true;
    this._setMembersViewControlsDisabled(true);

    // Gather data from all editable rows
    const rows = document.querySelectorAll("#members-table tbody tr.editing-row");
    const allMemberData = [];

    rows.forEach((row) => {
      const memberId = row.getAttribute("data-member-id");
      if (!memberId || memberId === "__new__") return;

      const activeCheckbox = row.querySelector('input[name="inline-active"]');
      const typeSelect = row.querySelector('select[name="inline-type"]');
      const memberData = {
        id: memberId,
        alias: row.querySelector('input[name="inline-name"]').value.trim(),
        name: row.querySelector('input[name="inline-name"]').value.trim(),
        email: "",
        type: typeSelect ? typeSelect.value : "ADULT",
        roles: [],
        relations: [],
        active: activeCheckbox ? activeCheckbox.checked : true,
      };

      // Only get email, roles, and relations for ADULT members
      if (memberData.type !== "KID") {
        const emailInput = row.querySelector('input[name="inline-email"]');
        if (emailInput) {
          memberData.email = emailInput.value.trim();
        }

        const adminCheckbox = row.querySelector('input[name="inline-admin"]');
        if (adminCheckbox && adminCheckbox.checked) {
          memberData.roles.push("ADMIN");
        }

        const relationCheckboxes = row.querySelectorAll(
          'input[name="inline-relations"]:checked',
        );
        relationCheckboxes.forEach((checkbox) => {
          memberData.relations.push(checkbox.value);
        });
      }

      allMemberData.push(memberData);
    });

    // Call server to save all members
    API.saveAllMembers({ members: allMemberData })
      .then((result) => {
        btnText.style.display = "inline";
        btnLoading.style.display = "none";
        applyBtn.disabled = false;

        UI.showToast("Tots els membres desats correctament", "success");
        MEMBERS.currentEditingMemberId = null;
        this.allOriginalMemberData = null;
        this.isEditingAllMembers = false;

        // Hide action bar
        const actionsBar = document.getElementById("members-edit-actions");
        if (actionsBar) {
          actionsBar.style.display = "none";
        }

        // Show edit button again
        const editAllBtn = document.getElementById("edit-all-members-btn");
        if (editAllBtn) editAllBtn.style.display = "";

        // Hide Active column
        document.querySelectorAll(".active-column").forEach((el) => {
          el.style.display = "none";
        });

        allMemberData.forEach((updatedMember) => {
          const memberIndex = MEMBERS.membersData.findIndex((m) => {
            return String(m.id) === String(updatedMember.id);
          });
          if (memberIndex !== -1) {
            const currentMember = MEMBERS.membersData[memberIndex] || {};
            MEMBERS.membersData[memberIndex] = {
              ...currentMember,
              ...updatedMember,
            };
          }
        });
        MEMBERS._rebuildRelatedMembers();
        MEMBERS._saveVersion++;
        CACHE._write({ key: "members", data: MEMBERS.membersData });
        APP.bumpLocalVersion('members');
        MEMBERS._renderMembersTable();
      })
      .catch((error) => {
        btnText.style.display = "inline";
        btnLoading.style.display = "none";
        applyBtn.disabled = false;
        UI.showToast("Error desant els membres: " + error, "error");
        console.error("Save all members error:", error);
      })
      .finally(() => {
        this._setMembersViewControlsDisabled(false);
      });
  }

  _applyInlineEdit() {
    if (!MEMBERS.currentEditingMemberId) return;

    // Handle editing all members
    if (this.isEditingAllMembers) {
      this._applyAllMembersEdit();
      return;
    }

    const applyBtn = document.getElementById("members-edit-apply");
    const btnText = applyBtn.querySelector(".btn-text");
    const btnLoading = applyBtn.querySelector(".btn-loading");

    // Show loading state
    btnText.style.display = "none";
    btnLoading.style.display = "inline";
    applyBtn.disabled = true;

    // Gather data from inline inputs
    const row = document.querySelector(
      `tr[data-member-id="${MEMBERS.currentEditingMemberId}"]`,
    );
    if (!row) {
      btnText.style.display = "inline";
      btnLoading.style.display = "none";
      applyBtn.disabled = false;
      UI.showToast("Error: fila no trobada", "error");
      return;
    }

    this._setMembersViewControlsDisabled(true);

    const activeCheckbox = row.querySelector('input[name="inline-active"]');
    const memberData = {
      id: MEMBERS.currentEditingMemberId === "__new__" ? null : MEMBERS.currentEditingMemberId,
      alias: row.querySelector('input[name="inline-name"]').value.trim(),
      name: row.querySelector('input[name="inline-name"]').value.trim(),
      email: "",
      type: row.querySelector('select[name="inline-type"]').value,
      roles: [],
      relations: [],
      active: activeCheckbox ? activeCheckbox.checked : true,
      isNew: this.isAddingNewMember,
    };

    // Only get email, roles, and relations for ADULT members
    if (memberData.type !== "KID") {
      // Get email
      const emailInput = row.querySelector('input[name="inline-email"]');
      if (emailInput) {
        memberData.email = emailInput.value.trim();
      }

      // Get admin role
      const adminCheckbox = row.querySelector('input[name="inline-admin"]');
      if (adminCheckbox && adminCheckbox.checked) {
        memberData.roles.push("ADMIN");
      }

      // Get selected relations (as IDs)
      const relationCheckboxes = row.querySelectorAll(
        'input[name="inline-relations"]:checked',
      );
      relationCheckboxes.forEach((checkbox) => {
        memberData.relations.push(checkbox.value);
      });
    }

    // Call server to save
    API.saveMember({ member: memberData })
      .then((result) => {
        const wasAddingNewMember = this.isAddingNewMember;
        btnText.style.display = "inline";
        btnLoading.style.display = "none";
        applyBtn.disabled = false;

        const successMsg = this.isAddingNewMember
          ? "Membre creat correctament"
          : "Membre desat correctament";
        UI.showToast(successMsg, "success");
        MEMBERS.currentEditingMemberId = null;
        this.originalMemberData = null;
        this.isAddingNewMember = false;

        // Hide action bar and restore text
        const actionsBar = document.getElementById("members-edit-actions");
        const editInfo = actionsBar?.querySelector(".edit-info");
        if (actionsBar) {
          actionsBar.style.display = "none";
          if (editInfo) editInfo.textContent = "Editant membre...";
        }

        // Hide Active column
        document.querySelectorAll(".active-column").forEach((el) => {
          el.style.display = "none";
        });

        if (wasAddingNewMember) {
          MEMBERS.membersData = MEMBERS.membersData.filter((member) => {
            return String(member.id) !== "__new__";
          });
        }

        const savedMember = result?.member;
        if (savedMember) {
          const memberIndex = MEMBERS.membersData.findIndex((m) => {
            return String(m.id) === String(savedMember.id);
          });
          if (memberIndex !== -1) {
            const currentMember = MEMBERS.membersData[memberIndex] || {};
            MEMBERS.membersData[memberIndex] = {
              ...currentMember,
              ...savedMember,
            };
          } else {
            MEMBERS.membersData.unshift(savedMember);
          }
        }
        MEMBERS._rebuildRelatedMembers();
        MEMBERS._saveVersion++;
        CACHE._write({ key: "members", data: MEMBERS.membersData });
        APP.bumpLocalVersion('members');
        MEMBERS._renderMembersTable();
      })
      .catch((error) => {
        btnText.style.display = "inline";
        btnLoading.style.display = "none";
        applyBtn.disabled = false;
        UI.showToast("Error desant el membre: " + error, "error");
        console.error("Save member error:", error);
      })
      .finally(() => {
        this._setMembersViewControlsDisabled(false);
      });
  }

  _updateSortIcons() {
    const headers = document.querySelectorAll("#members-table th.sortable");
    headers.forEach((th) => {
      const icon = th.querySelector(".sort-icon");
      if (th.getAttribute("data-sort") === MEMBERS.membersSortColumn) {
        icon.textContent = MEMBERS.membersSortDirection === "asc" ? " ▲" : " ▼";
      } else {
        icon.textContent = "";
      }
    });
  }

  _rebuildRelatedMembers() {
    const membersById = {};
    MEMBERS.membersData.forEach((member) => {
      membersById[String(member.id)] = member;
    });

    MEMBERS.membersData = MEMBERS.membersData.map((member) => {
      const relationIds = Array.isArray(member.relations)
        ? member.relations.map((relationId) => String(relationId))
        : [];

      const relatedMembers = relationIds
        .map((relationId) => membersById[relationId])
        .filter((relatedMember) => !!relatedMember)
        .map((relatedMember) => {
          const relatedAlias = relatedMember.alias || relatedMember.name || "";
          const relatedName = relatedMember.name || relatedAlias;
          const avatarUrl =
            relatedMember.avatar ||
            ("https://ui-avatars.com/api/?name=" +
              encodeURIComponent(relatedAlias || "?") +
              "&background=random");

          return {
            id: relatedMember.id,
            alias: relatedAlias,
            name: relatedName,
            type: relatedMember.type || "",
            avatar: avatarUrl,
          };
        });

      return {
        ...member,
        relatedMembers,
      };
    });
  }

  _setMembersViewControlsDisabled(disabled) {
    const membersView = document.getElementById("view-members");
    if (!membersView) return;

    const controls = membersView.querySelectorAll("input, select, textarea, button");
    controls.forEach((control) => {
      control.disabled = !!disabled;
    });
  }

  _renderEditableRow(member) {
    const typeOptions = `
          <option value="ADULT" ${member.type === "ADULT" ? "selected" : ""}>Adult</option>
          <option value="KID" ${member.type === "KID" ? "selected" : ""}>Xiquet/a</option>
      `;

    const isAdmin = (member.roles || []).includes("ADMIN");
    const isKid = member.type === "KID";

    // Email field (disabled for KID)
    const emailHtml = isKid
      ? '<span class="text-muted">-</span>'
      : `<input type="email" class="inline-edit-input" name="inline-email" value="${member.email || ""}">`;

    // Roles field (disabled for KID)
    const rolesHtml = isKid
      ? '<span class="text-muted">-</span>'
      : `<label class="checkbox-label inline-checkbox">
                  <input type="checkbox" name="inline-admin" ${isAdmin ? "checked" : ""}> Admin
              </label>`;

    // Build relations checkboxes (only for ADULT members)
    let relationsHtml = "";
    if (isKid) {
      relationsHtml = '<span class="text-muted">-</span>';
    } else {
      relationsHtml =
        '<div class="inline-relations-dropdown" id="inline-relations-container">';
      relationsHtml +=
        '<button type="button" class="btn-dropdown" onclick="MEMBERS.toggleRelationsDropdown(this)">Seleccionar ▼</button>';
      relationsHtml +=
        '<div class="relations-dropdown-content" style="display:none;">';
      MEMBERS.membersData.forEach((m) => {
        if (m.id !== member.id) {
          const checked = (member.relations || []).includes(m.id)
            ? "checked"
            : "";
          relationsHtml += `<label class="checkbox-label"><input type="checkbox" name="inline-relations" value="${m.id}" data-name="${m.name}" ${checked}> ${m.name}</label>`;
        }
      });
      relationsHtml += "</div></div>";
    }

    const isActive = member.active !== false;
    return `
          <td><input type="text" class="inline-edit-input" name="inline-name" value="${member.alias || ""}" required></td>
          <td class="email-cell">${emailHtml}</td>
          <td>
          <select class="inline-edit-select" name="inline-type" onchange="MEMBERS.handleInlineTypeChange(this)">${typeOptions}</select>
          </td>
          <td class="roles-cell">${rolesHtml}</td>
          <td class="relations-cell">${relationsHtml}</td>
          <td class="active-column">
          <label class="checkbox-label inline-checkbox">
              <input type="checkbox" name="inline-active" ${isActive ? "checked" : ""}> Actiu
          </label>
          </td>
          <td></td>
          <td></td>
          <td></td>
      `;
  }

  drawPositionDiagram(opts) {
    var targetEl = document.getElementById(opts.canvasId);
    if (!targetEl) return;
    var isImage = targetEl.tagName === "IMG";
    var canvas;
    if (isImage) {
      canvas = document.createElement("canvas");
      canvas.width = parseInt(targetEl.getAttribute("width")) || 600;
      canvas.height = parseInt(targetEl.getAttribute("height")) || 250;
    } else {
      canvas = targetEl;
    }
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var rows = opts.rows || 2;
    var cols = opts.cols || 2;
    var positions = opts.positions || [];
    var diagramColors = opts.diagramColors || { backgroundColor: {}, textColor: {} };
    var highlightTags = opts.highlightTags || [];
    var inProgressTags = opts.inProgressTags || [];
    var pendingTags = opts.pendingTags || [];
    var activeForm = opts.form || 'grid';

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (activeForm === 'radial') {
      this.drawRadialPositionDiagram(ctx, canvas, rows, cols, positions, diagramColors, highlightTags, inProgressTags, pendingTags);
      if (isImage) { targetEl.src = canvas.toDataURL(); targetEl.setAttribute("width", canvas.width); targetEl.setAttribute("height", canvas.height); }
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
        var isPending = pendingTags.indexOf(tag) !== -1;

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

        if (!isHighlighted && !isInProgress && !isPending) {
          ctx.globalAlpha = 0.3;
        }

        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, squareWidth, squareHeight);

        ctx.globalAlpha = 1;

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = Math.max(2, 4 * scale);
        ctx.strokeRect(x, y, squareWidth, squareHeight);

        if (isHighlighted && !isPending) {
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
        if (isInProgress && !isPending) {
          var iconS = Math.min(squareWidth, squareHeight) * 0.6;
          var fontSize = Math.round(iconS);

          ctx.save();
          ctx.font = fontSize + "px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🏋️‍♀️", x + squareWidth / 2, y + squareHeight / 2);
          ctx.restore();
        }

        if (isPending) {
          var pendingCx = x + squareWidth / 2;
          var pendingCy = y + squareHeight / 2;
          var pendingIconSize = Math.round(Math.min(squareWidth, squareHeight) * 0.58);

          ctx.save();
          ctx.font = pendingIconSize + "px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⏳", pendingCx, pendingCy);
          ctx.restore();
        }
      }
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
    if (isImage) { targetEl.src = canvas.toDataURL(); targetEl.setAttribute("width", canvas.width); targetEl.setAttribute("height", canvas.height); }
  }

  loadMemberPositionsData() {
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
          try {
            var danceName = dance.name;
            var memberEntries = positions[danceName] || {};
            var dancePositions = Array.isArray(dance.positions) ? dance.positions : [];
            var memberTags = dancePositions.filter(function (pos) {
              return pos && pos.order != null && String(memberEntries[pos.order]).toUpperCase() === MEMBERS.POSITION_OK;
            }).map(function (pos) { return pos.tag; });
            var inProgressTags = dancePositions.filter(function (pos) {
              return pos && pos.order != null && String(memberEntries[pos.order]).toUpperCase() === MEMBERS.POSITION_IN_PROGRESS;
            }).map(function (pos) { return pos.tag; });
            var diagramColors = dance.diagram || { backgroundColor: {}, textColor: {} };
            var rows = dance.structure ? dance.structure.rows : 2;
            var cols = dance.structure ? dance.structure.columns : 2;

            var cardId = positionCardId++;
            var canvasId = "position-canvas-" + cardId;

            var legendHtml = "";
            var seenLabels = {};
            dancePositions.forEach(function (pos) {
              if (!pos || !pos.positionType || !pos.positionType.label) return;
              var positionLabel = pos.positionType.label;
              if (seenLabels[positionLabel]) return;
              seenLabels[positionLabel] = true;
              var color = (diagramColors.backgroundColor && diagramColors.backgroundColor[positionLabel]) || "#808080";
              legendHtml += '<div class="diagram-legend-item">' +
                '<span class="legend-color-box" style="background: ' + color + ';"></span>' +
                '<span>' + positionLabel + '</span>' +
                '</div>';
            });
            var showLegend = Object.keys(seenLabels).length > 1;

            var forms = dance.structure && dance.structure.forms ? dance.structure.forms : ['grid'];

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
            MEMBERS.drawPositionDiagram(positionDrawOpts);

            var renderedEl = document.getElementById(canvasId);
            if (renderedEl && renderedEl.tagName === "CANVAS") {
              try {
                var img = new Image();
                img.src = renderedEl.toDataURL();
                img.id = canvasId;
                img.setAttribute("width", renderedEl.width);
                img.setAttribute("height", renderedEl.height);
                img.style.cssText = "width:100%;max-width:100%;height:auto;display:block;";
                renderedEl.parentNode.replaceChild(img, renderedEl);
                renderedEl = img;
              } catch (e) {}
            }
            if (renderedEl) {
              renderedEl.style.cursor = "pointer";
              renderedEl.addEventListener("click", function (event) {
                MEMBERS.handlePositionClick(event, renderedEl, {
                  memberAlias: alias,
                  danceName: danceName,
                  rows: rows,
                  cols: cols,
                  positions: dancePositions,
                  memberEntries: memberEntries,
                  diagramColors: diagramColors,
                  form: forms[0]
                });
              });
            }
          } catch (danceError) {
            console.error("Failed to render dance positions:", dance && dance.name, danceError);
          }
        });
      })
      .catch(function (error) {
        console.error("Failed to load positions:", error);
        if (loading) loading.style.display = "none";
        list.innerHTML = '<div class="empty-state"><p>No s\'han pogut carregar les posicions.</p></div>';
        UI.showToast(error || "No s'han pogut carregar les posicions.", "error");
      });
  }

  toggleRelationsDropdown(btn) {
    const dropdown = btn.nextElementSibling;
    dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
  }

  handlePositionClick(event, canvas, data) {
    var dialog = document.getElementById("position-value-dialog");
    
    // Don't handle click if dialog is currently open
    if (dialog && dialog.open) {
      return;
    }
    
    var rect = canvas.getBoundingClientRect();
    var origW = parseInt(canvas.getAttribute("width")) || canvas.width;
    var origH = parseInt(canvas.getAttribute("height")) || canvas.height;
    var scaleX = rect.width ? origW / rect.width : 1;
    var scaleY = rect.height ? origH / rect.height : 1;
    var x = (event.clientX - rect.left) * scaleX;
    var y = (event.clientY - rect.top) * scaleY;

    var clickedOrder = this.getClickedPositionOrder(x, y, { width: origW, height: origH }, data.rows, data.cols, data.form);
    if (clickedOrder === null) return;

    this.showPositionValueDialog(canvas, data, clickedOrder);
  }

  showPositionValueDialog(canvas, data, clickedOrder) {
    var dialog = document.getElementById("position-value-dialog");
    if (!dialog) return;
    
    // If dialog is already open, close it first and wait
    if (dialog.open) {
      UI.closeDialogWithBackdrop(dialog);
      setTimeout(function() {
        MEMBERS.showPositionValueDialog(canvas, data, clickedOrder);
      }, 100);
      return;
    }

    var optionButtons = dialog.querySelectorAll(".position-value-option");
    
    // Remove any existing listeners by cloning and replacing buttons
    optionButtons.forEach(function(btn) {
      var newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
    });
    
    // Get the new buttons after cloning
    optionButtons = dialog.querySelectorAll(".position-value-option");

    var currentValue = String(data.memberEntries[clickedOrder] || "").toUpperCase();

    optionButtons.forEach(function(btn) {
      var optionValue = String(btn.getAttribute("data-value") || "").toUpperCase();
      var isSelected = optionValue === currentValue;
      btn.classList.toggle("is-selected", isSelected);
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    
    var clickHandler = function(event) {
      var selectedValue = this.getAttribute("data-value");
      UI.closeDialogWithBackdrop(dialog);
      
      MEMBERS.updatePositionValue(canvas, data, clickedOrder, selectedValue);
    };
    
    optionButtons.forEach(function(btn) {
      btn.addEventListener("click", clickHandler);
    });
    
    UI.showDialogWithBackdrop(dialog);
  }

  updatePositionValue(canvas, data, clickedOrder, newValue) {
    var clickedPosition = data.positions.find(function (pos) {
      return pos.order === clickedOrder;
    });
    var pendingTags = clickedPosition && clickedPosition.tag ? [clickedPosition.tag] : [];

    function redrawPosition(pending) {
      var memberTags = data.positions.filter(function (pos) {
        return String(data.memberEntries[pos.order]).toUpperCase() === MEMBERS.POSITION_OK;
      }).map(function (pos) { return pos.tag; });

      var inProgressTags = data.positions.filter(function (pos) {
        return String(data.memberEntries[pos.order]).toUpperCase() === MEMBERS.POSITION_IN_PROGRESS;
      }).map(function (pos) { return pos.tag; });

      MEMBERS.drawPositionDiagram({
        canvasId: canvas.id,
        rows: data.rows,
        cols: data.cols,
        positions: data.positions,
        diagramColors: data.diagramColors,
        highlightTags: memberTags,
        inProgressTags: inProgressTags,
        pendingTags: pending || [],
        form: data.form
      });
    }

    redrawPosition(pendingTags);

    API.updateMemberPosition({
      memberAlias: data.memberAlias,
      danceName: data.danceName,
      positionOrder: clickedOrder,
      value: newValue
    })
      .then(function () {
        data.memberEntries[clickedOrder] = newValue;
        redrawPosition([]);
        
        UI.showToast("Posició actualitzada correctament", "success");
      })
      .catch(function (error) {
        redrawPosition([]);
        console.error("Failed to update position:", error);
        UI.showToast(error || "Error en actualitzar la posició", "error");
      });
  }

  handleInlineTypeChange(selectEl) {
    const row = selectEl.closest("tr");
    const emailCell = row.querySelector(".email-cell");
    const rolesCell = row.querySelector(".roles-cell");
    const relationsCell = row.querySelector(".relations-cell");
    const memberId = row.getAttribute("data-member-id");
    const member = MEMBERS.membersData.find(function (m) {
      return String(m.id) === String(memberId);
    });

    if (selectEl.value === "KID") {
      // Clear and disable email, roles, and relations for KID
      if (emailCell) emailCell.innerHTML = '<span class="text-muted">-</span>';
      if (rolesCell) rolesCell.innerHTML = '<span class="text-muted">-</span>';
      if (relationsCell)
        relationsCell.innerHTML = '<span class="text-muted">-</span>';
    } else {
      // Restore email field for ADULT
      if (emailCell) {
        const email = member ? member.email || "" : "";
        emailCell.innerHTML = `<input type="email" class="inline-edit-input" name="inline-email" value="${email}">`;
      }

      // Restore roles for ADULT
      if (rolesCell) {
        const isAdmin = member && (member.roles || []).includes("ADMIN");
        rolesCell.innerHTML = `<label class="checkbox-label inline-checkbox">
                  <input type="checkbox" name="inline-admin" ${isAdmin ? "checked" : ""}> Admin
              </label>`;
      }

      // Restore relations dropdown for ADULT
      if (relationsCell) {
        let relationsHtml =
          '<div class="inline-relations-dropdown" id="inline-relations-container">';
        relationsHtml +=
          '<button type="button" class="btn-dropdown" onclick="MEMBERS.toggleRelationsDropdown(this)">Seleccionar ▼</button>';
        relationsHtml +=
          '<div class="relations-dropdown-content" style="display:none;">';
        MEMBERS.membersData.forEach((m) => {
          if (String(m.id) !== String(memberId)) {
            const checked =
              member && (member.relations || []).includes(m.id)
                ? "checked"
                : "";
            relationsHtml += `<label class="checkbox-label"><input type="checkbox" name="inline-relations" value="${m.id}" data-name="${m.name}" ${checked}> ${m.name}</label>`;
          }
        });
        relationsHtml += "</div></div>";
        relationsCell.innerHTML = relationsHtml;
      }
    }
  }

  _startInlineEdit(memberId) {
    // If already editing another member, cancel that edit first
    if (MEMBERS.currentEditingMemberId && String(MEMBERS.currentEditingMemberId) !== String(memberId)) {
      this._cancelInlineEdit();
    }

    const member = MEMBERS.membersData.find(function (m) {
      return String(m.id) === String(memberId);
    });
    if (!member) {
      console.error("Member not found. memberId:", memberId, "Available IDs:", MEMBERS.membersData.map(m => m.id));
      UI.showToast("Membre no trobat", "error");
      return;
    }

    // Store original data for discard
    MEMBERS.currentEditingMemberId = memberId;
    this.originalMemberData = JSON.parse(JSON.stringify(member));

    // Show action bar
    const actionsBar = document.getElementById("members-edit-actions");
    if (actionsBar) {
      actionsBar.style.display = "flex";
    }

    // Show Active column
    document.querySelectorAll(".active-column").forEach((el) => {
      el.style.display = "";
    });

    // Re-render table to show editable row
    MEMBERS._renderMembersTable();

    // Initialize action bar listeners
    this._initInlineEditListeners();
  }

  _openPasswordDialog(email, name) {
    APP.closeAllDialogs();
    const dialog = document.getElementById("password-change-dialog");
    const memberNameEl = document.getElementById("password-change-member-name");
    const newPasswordInput = document.getElementById("new-password");
    const confirmPasswordInput = document.getElementById("confirm-password");

    if (!dialog) return;

    this.passwordChangeMemberEmail = email;
    if (memberNameEl) memberNameEl.textContent = name + " (" + email + ")";
    if (newPasswordInput) newPasswordInput.value = "";
    if (confirmPasswordInput) confirmPasswordInput.value = "";

    this._initPasswordChangeHandlers();
    UI.showDialogWithBackdrop(dialog);
    if (newPasswordInput) newPasswordInput.focus();
  }

  _closePasswordDialog() {
    UI.closeDialogWithBackdrop("password-change-dialog");
    this.passwordChangeMemberEmail = null;
  }

  _saveNewPassword() {
    const newPassword = document.getElementById("new-password")?.value || "";
    const confirmPassword =
      document.getElementById("confirm-password")?.value || "";
    const saveBtn = document.getElementById("password-save-btn");

    // Validation
    if (!newPassword) {
      UI.showToast("Cal introduir una contrasenya", "error");
      return;
    }

    if (newPassword.length < 8) {
      UI.showToast("La contrasenya ha de tenir almenys 8 caràcters", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      UI.showToast("Les contrasenyes no coincideixen", "error");
      return;
    }

    if (!this.passwordChangeMemberEmail) {
      UI.showToast("Error: no s'ha seleccionat cap membre", "error");
      return;
    }

    // Disable button during save
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Desant...";
    }

    API.changeUserPassword({ email: this.passwordChangeMemberEmail, newPassword })
      .then((result) => {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = "Desar";
        }
        this._closePasswordDialog();
        UI.showToast(
          result.message || "Contrasenya canviada correctament",
          "success",
        );
      })
      .catch((error) => {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = "Desar";
        }
        UI.showToast(error || "Error en canviar la contrasenya", "error");
        console.error("Password change error:", error);
      });
  }

  loadMembersData() {
    const tbody = document.querySelector("#members-table tbody");
    if (tbody)
      tbody.innerHTML = '<tr><td colspan="5">Carregant membres...</td></tr>';

    const loadVersion = this._saveVersion;
    API.getMembers({ onBackgroundUpdate: (members) => {
        if (this._saveVersion !== loadVersion) return;
        if (Array.isArray(members)) {
          MEMBERS.membersData = members;
          this._renderMembersTable();
        }
      }})
      .then((members) => {
        if (!Array.isArray(members)) {
          tbody.innerHTML =
            '<tr><td colspan="5">No s\'ha pogut carregar la llista de membres</td></tr>';
          return;
        }
        MEMBERS.membersData = members;
        this._initMembersFilters();
        this._renderMembersTable();
      })
      .catch((error) => {
        console.error("Error loading members data:", error);
        tbody.innerHTML =
          '<tr><td colspan="5">No s\'ha pogut carregar la llista de membres</td></tr>';
      });
  }

  loadMembersDataForEvents() {
    API.getMembers()
      .then((members) => {
        if (Array.isArray(members)) {
          MEMBERS.membersData = members;
        }
      })
      .catch((error) => {
        console.error("Error loading members for events:", error);
      });
  }

  startEditAllMembers() {
    // Cancel any existing single edit
    if (MEMBERS.currentEditingMemberId) {
      this._cancelInlineEdit();
    }

    // Store original data for all members
    this.allOriginalMemberData = JSON.parse(JSON.stringify(MEMBERS.membersData));
    this.isEditingAllMembers = true;
    MEMBERS.currentEditingMemberId = "__all__";

    // Show action bar
    const actionsBar = document.getElementById("members-edit-actions");
    const editInfo = actionsBar ? actionsBar.querySelector(".edit-info") : null;
    if (actionsBar) {
      actionsBar.style.display = "flex";
      if (editInfo) editInfo.textContent = "Editant tots els membres...";
    }

    // Hide edit button
    const editAllBtn = document.getElementById("edit-all-members-btn");
    if (editAllBtn) editAllBtn.style.display = "none";

    // Show Active column
    document.querySelectorAll(".active-column").forEach((el) => {
      el.style.display = "";
    });

    // Re-render table with all rows editable
    MEMBERS._renderMembersTable();

    // Initialize action bar listeners
    this._initInlineEditListeners();
  }

  _openCommunicationDialog() {
    APP.closeAllDialogs();
    const dialog = document.getElementById("communication-dialog");
    if (!dialog) return;
    document.getElementById("communication-title").value = "";
    document.getElementById("communication-message").value = "";
    const allRadio = dialog.querySelector('input[name="communication-audience"][value="all"]');
    if (allRadio) allRadio.checked = true;
    const searchInput = document.getElementById("communication-recipients-search");
    if (searchInput) searchInput.value = "";
    this._communicationSelectedIds = new Set();
    this._renderCommunicationRecipients();
    this._updateCommunicationAudienceVisibility();
    this._setCommunicationSending(false);
    this._initCommunicationHandlers();
    UI.showDialogWithBackdrop(dialog);
  }

  _closeCommunicationDialog() {
    UI.closeDialogWithBackdrop("communication-dialog");
  }

  _setCommunicationSending(sending) {
    const sendBtn = document.getElementById("communication-send-btn");
    if (!sendBtn) return;
    sendBtn.querySelector(".btn-text").style.display = sending ? "none" : "";
    sendBtn.querySelector(".btn-loading").style.display = sending ? "inline-flex" : "none";
    sendBtn.disabled = sending;
  }

  _getCommunicationAudience() {
    const checked = document.querySelector('input[name="communication-audience"]:checked');
    return checked ? checked.value : "all";
  }

  _getCommunicationCandidateMembers() {
    return (MEMBERS.membersData || []).filter(
      (m) => m.active !== false && m.email
    );
  }

  _renderCommunicationRecipients() {
    const list = document.getElementById("communication-recipients-list");
    if (!list) return;
    const searchInput = document.getElementById("communication-recipients-search");
    const search = (searchInput?.value || "").toLowerCase().trim();
    const candidates = this._getCommunicationCandidateMembers();
    const filtered = candidates.filter((m) => {
      if (!search) return true;
      return (
        (m.alias || "").toLowerCase().includes(search) ||
        (m.name || "").toLowerCase().includes(search) ||
        (m.email || "").toLowerCase().includes(search)
      );
    });
    if (!this._communicationSelectedIds) this._communicationSelectedIds = new Set();
    if (filtered.length === 0) {
      list.innerHTML = '<div class="communication-recipients-empty">No hi ha membres disponibles</div>';
    } else {
      list.innerHTML = filtered
        .map((m) => {
          const id = m.email;
          const checked = this._communicationSelectedIds.has(id) ? "checked" : "";
          const label = m.alias || m.name || m.email;
          const sub = m.alias && m.name ? m.name : m.email;
          return `
            <label class="communication-recipient-item">
              <input type="checkbox" value="${id}" ${checked}>
              <span class="communication-recipient-info">
                <span class="communication-recipient-name">${label}</span>
                <span class="communication-recipient-sub">${sub}</span>
              </span>
            </label>
          `;
        })
        .join("");
      list.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.addEventListener("change", (e) => {
          const id = e.target.value;
          if (e.target.checked) this._communicationSelectedIds.add(id);
          else this._communicationSelectedIds.delete(id);
          this._updateCommunicationRecipientsCount();
        });
      });
    }
    this._updateCommunicationRecipientsCount();
  }

  _updateCommunicationRecipientsCount() {
    const countEl = document.getElementById("communication-recipients-count");
    if (!countEl) return;
    const n = this._communicationSelectedIds ? this._communicationSelectedIds.size : 0;
    countEl.textContent = n === 1 ? "1 seleccionat" : `${n} seleccionats`;
  }

  _updateCommunicationAudienceVisibility() {
    const group = document.getElementById("communication-recipients-group");
    if (!group) return;
    const audience = this._getCommunicationAudience();
    group.style.display = audience === "specific" ? "" : "none";
  }

  _sendCommunication() {
    const title = document.getElementById("communication-title").value.trim();
    const message = document.getElementById("communication-message").value.trim();
    if (!title || !message) {
      UI.showToast("Omple el títol i el missatge", "error");
      return;
    }
    const audience = this._getCommunicationAudience();
    let recipientUserIds = null;
    if (audience === "specific") {
      recipientUserIds = Array.from(this._communicationSelectedIds || []);
      if (recipientUserIds.length === 0) {
        UI.showToast("Selecciona almenys un membre", "error");
        return;
      }
    }
    this._setCommunicationSending(true);
    API.sendCommunication({ title, message, recipientUserIds })
      .then(() => {
        this._closeCommunicationDialog();
        UI.showToast("Comunicat enviat correctament", "success");
      })
      .catch((error) => {
        this._setCommunicationSending(false);
        UI.showToast(error || "Error enviant el comunicat", "error");
      });
  }

  _initCommunicationHandlers() {
    const cancelBtn = document.getElementById("communication-cancel-btn");
    const sendBtn = document.getElementById("communication-send-btn");
    if (cancelBtn) {
      const newCancel = cancelBtn.cloneNode(true);
      cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
      newCancel.addEventListener("click", () => this._closeCommunicationDialog());
    }
    if (sendBtn) {
      const newSend = sendBtn.cloneNode(true);
      sendBtn.parentNode.replaceChild(newSend, sendBtn);
      newSend.addEventListener("click", () => this._sendCommunication());
    }
    document.querySelectorAll('input[name="communication-audience"]').forEach((radio) => {
      const fresh = radio.cloneNode(true);
      radio.parentNode.replaceChild(fresh, radio);
      fresh.addEventListener("change", () => this._updateCommunicationAudienceVisibility());
    });
    const searchInput = document.getElementById("communication-recipients-search");
    if (searchInput) {
      const fresh = searchInput.cloneNode(true);
      searchInput.parentNode.replaceChild(fresh, searchInput);
      fresh.addEventListener("input", () => this._renderCommunicationRecipients());
    }
    const selectAllBtn = document.getElementById("communication-recipients-select-all");
    if (selectAllBtn) {
      const fresh = selectAllBtn.cloneNode(true);
      selectAllBtn.parentNode.replaceChild(fresh, selectAllBtn);
      fresh.addEventListener("click", () => {
        if (!this._communicationSelectedIds) this._communicationSelectedIds = new Set();
        this._getCommunicationCandidateMembers().forEach((m) => {
          this._communicationSelectedIds.add(m.email);
        });
        this._renderCommunicationRecipients();
      });
    }
    const clearBtn = document.getElementById("communication-recipients-clear");
    if (clearBtn) {
      const fresh = clearBtn.cloneNode(true);
      clearBtn.parentNode.replaceChild(fresh, clearBtn);
      fresh.addEventListener("click", () => {
        this._communicationSelectedIds = new Set();
        this._renderCommunicationRecipients();
      });
    }
  }

  _initPasswordChangeHandlers() {
    const dialog = document.getElementById("password-change-dialog");
    const cancelBtn = document.getElementById("password-cancel-btn");
    const saveBtn = document.getElementById("password-save-btn");

    if (cancelBtn && !cancelBtn.dataset.initialized) {
      cancelBtn.addEventListener("click", this._closePasswordDialog.bind(this));
      cancelBtn.dataset.initialized = "true";
    }

    if (saveBtn && !saveBtn.dataset.initialized) {
      saveBtn.addEventListener("click", this._saveNewPassword.bind(this));
      saveBtn.dataset.initialized = "true";
    }

    // Close on backdrop click
    if (dialog && !dialog.dataset.initialized) {
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) {
          this._closePasswordDialog();
        }
      });
      dialog.dataset.initialized = "true";
    }
  }

  formatNamesList(names) {
    if (!names || names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + " i " + names[1];
    const lastIndex = names.length - 1;
    return names.slice(0, lastIndex).join(", ") + " i " + names[lastIndex];
  }

  getClickedPositionOrder(x, y, canvas, rows, cols, form) {
    if (form === 'radial') {
      return this.getClickedPositionOrderRadial(x, y, canvas, rows, cols);
    }
    return this.getClickedPositionOrderGrid(x, y, canvas, rows, cols);
  }

  getClickedPositionOrderRadial(x, y, canvas, rows, cols) {
    var rl = this.calcRadialPositionLayout(canvas, rows, cols);

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var order = row * cols + col + 1;

        var cellCenterX = rl.centerX;
        var cellCenterY = rl.centerY - rl.coupleHeight / 2 + row * (rl.cellHeight + rl.coupleGap) + rl.cellHeight / 2;
        var cellX = cellCenterX - rl.cellWidth / 2;
        var cellY = cellCenterY - rl.cellHeight / 2;

        if (x >= cellX && x <= cellX + rl.cellWidth && y >= cellY && y <= cellY + rl.cellHeight) {
          return order;
        }
      }
    }

    return null;
  }

  getClickedPositionOrderGrid(x, y, canvas, rows, cols) {
    var layout = calcDiagramLayout(canvas, 1, rows, cols);
    var squareWidth = layout.squareWidth;
    var squareHeight = layout.squareHeight;
    var squareSpacingX = layout.squareSpacingX;
    var squareSpacingY = layout.squareSpacingY;
    var offsetX0 = layout.offsetX0;
    var offsetY = layout.offsetY;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var order = row * cols + col + 1;

        var cellX = offsetX0 + col * (squareWidth + squareSpacingX);
        var cellY = offsetY + row * (squareHeight + squareSpacingY);

        if (x >= cellX && x <= cellX + squareWidth && y >= cellY && y <= cellY + squareHeight) {
          return order;
        }
      }
    }

    return null;
  }

  drawRadialPositionDiagram(ctx, canvas, rows, cols, positions, diagramColors, highlightTags, inProgressTags, pendingTags) {
    pendingTags = pendingTags || [];
    var rl = this.calcRadialPositionLayout(canvas, rows, cols);
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
        var isPending = pendingTags.indexOf(tag) !== -1;

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

        if (!isHighlighted && !isInProgress && !isPending) {
          ctx.globalAlpha = 0.3;
        }

        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, rl.cellWidth, rl.cellHeight);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = Math.max(2, 4 * rl.scale);
        ctx.strokeRect(x, y, rl.cellWidth, rl.cellHeight);

        if (isHighlighted && !isPending) {
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
        if (isInProgress && !isPending) {
          var iconS = Math.min(rl.cellWidth, rl.cellHeight) * 0.6;
          var fontSize = Math.round(iconS);
          ctx.save();
          ctx.font = fontSize + "px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("\uD83C\uDFCB\uFE0F\u200D\u2640\uFE0F", x + rl.cellWidth / 2, y + rl.cellHeight / 2);
          ctx.restore();
        }

        if (isPending) {
          var pendingCx = x + rl.cellWidth / 2;
          var pendingCy = y + rl.cellHeight / 2;
          var pendingIconSize = Math.round(Math.min(rl.cellWidth, rl.cellHeight) * 0.58);

          ctx.save();
          ctx.font = pendingIconSize + "px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⏳", pendingCx, pendingCy);
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

  calcRadialPositionLayout(canvas, rows, cols) {
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

})();


