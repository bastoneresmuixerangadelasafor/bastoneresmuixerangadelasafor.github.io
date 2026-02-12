const MEMBERS = new (class AppMembers {
  constructor() {
    // Current member being edited inline
    this.currentEditingMemberId = null;
    this.originalMemberData = null;
    this.isAddingNewMember = false;
    this.membersData = [];
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

    document.addEventListener("click", (e) => {
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
      this.allOriginalMemberData = null;
      this.isEditingAllMembers = false;
    }

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
      tbody.innerHTML = '<tr><td colspan="8">No s\'han trobat membres</td></tr>';
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
        const activeIndicator = member.active !== false ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #4caf50;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #999;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
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
      discardBtn.addEventListener("click", () => this._cancelInlineEdit());
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

      function startLongPress() {
        hasMovedDuringPress = false;
        longPressTimer = setTimeout(function () {
          const memberId = row.getAttribute("data-member-id");
          if (memberId) {
            this._startInlineEdit(memberId);
          }
        }, longPressDuration);
      }

      function cancelLongPress() {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }

      // Touch events for mobile
      row.addEventListener("touchstart", function () {
        startLongPress();
      }, { passive: true });

      row.addEventListener("touchmove", function () {
        hasMovedDuringPress = true;
        cancelLongPress();
      }, { passive: true });

      row.addEventListener("touchend", function () {
        cancelLongPress();
      });

      row.addEventListener("touchcancel", function () {
        cancelLongPress();
      });

      // Mouse events for desktop
      row.addEventListener("mousedown", function () {
        startLongPress();
      });

      row.addEventListener("mouseup", function () {
        cancelLongPress();
      });

      row.addEventListener("mouseleave", function () {
        cancelLongPress();
      });

      row.addEventListener("mousemove", function () {
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
      tbody.innerHTML = '<tr><td colspan="6">Actualitzant membres...</td></tr>';

    API.getMembers({ forceRefresh: true })
      .then((members) => {
        // Remove spinning animation
        if (refreshBtn) {
          refreshBtn.classList.remove("refreshing");
          refreshBtn.disabled = false;
        }

        if (!Array.isArray(members)) {
          tbody.innerHTML =
            '<tr><td colspan="6">No s\'ha pogut carregar la llista de membres</td></tr>';
          return;
        }
        MEMBERS.membersData = members;
        this._renderMembersTable();
        showToast("Llista actualitzada", "success");
      })
      .catch((error) => {
        // Remove spinning animation
        if (refreshBtn) {
          refreshBtn.classList.remove("refreshing");
          refreshBtn.disabled = false;
        }
        console.error("Error refreshing members:", error);
        tbody.innerHTML =
          '<tr><td colspan="6">No s\'ha pogut carregar la llista de membres</td></tr>';
        showToast("Error actualitzant la llista", "error");
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

        if (result && result.success) {
          showToast("Tots els membres desats correctament", "success");
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

          // Reload members data
          MEMBERS.loadMembersData();
        } else {
          showToast(result?.error || "Error desant els membres", "error");
        }
      })
      .catch((error) => {
        btnText.style.display = "inline";
        btnLoading.style.display = "none";
        applyBtn.disabled = false;
        showToast("Error desant els membres: " + error, "error");
        console.error("Save all members error:", error);
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
      showToast("Error: fila no trobada", "error");
      return;
    }

    const activeCheckbox = row.querySelector('input[name="inline-active"]');
    const memberData = {
      id: MEMBERS.currentEditingMemberId === "__new__" ? null : MEMBERS.currentEditingMemberId,
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
        btnText.style.display = "inline";
        btnLoading.style.display = "none";
        applyBtn.disabled = false;

        if (result && result.success) {
          const successMsg = this.isAddingNewMember
            ? "Membre creat correctament"
            : "Membre desat correctament";
          showToast(successMsg, "success");
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

          // Reload members data
          MEMBERS.loadMembersData();
        } else {
          showToast(result?.error || "Error desant el membre", "error");
        }
      })
      .catch((error) => {
        btnText.style.display = "inline";
        btnLoading.style.display = "none";
        applyBtn.disabled = false;
        showToast("Error desant el membre: " + error, "error");
        console.error("Save member error:", error);
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
        '<button type="button" class="btn-dropdown" onclick="toggleRelationsDropdown(this)">Seleccionar ▼</button>';
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
          <select class="inline-edit-select" name="inline-type" onchange="handleInlineTypeChange(this)">${typeOptions}</select>
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
      `;
  }

  toggleRelationsDropdown(btn) {
    const dropdown = btn.nextElementSibling;
    dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
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
          '<button type="button" class="btn-dropdown" onclick="toggleRelationsDropdown(this)">Seleccionar ▼</button>';
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
      showToast("Membre no trobat", "error");
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
    showDialogWithBackdrop(dialog);
    if (newPasswordInput) newPasswordInput.focus();
  }

  _closePasswordDialog() {
    closeDialogWithBackdrop("password-change-dialog");
    this.passwordChangeMemberEmail = null;
  }

  _saveNewPassword() {
    const newPassword = document.getElementById("new-password")?.value || "";
    const confirmPassword =
      document.getElementById("confirm-password")?.value || "";
    const saveBtn = document.getElementById("password-save-btn");

    // Validation
    if (!newPassword) {
      showToast("Cal introduir una contrasenya", "error");
      return;
    }

    if (newPassword.length < 8) {
      showToast("La contrasenya ha de tenir almenys 8 caràcters", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("Les contrasenyes no coincideixen", "error");
      return;
    }

    if (!this.passwordChangeMemberEmail) {
      showToast("Error: no s'ha seleccionat cap membre", "error");
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
        showToast(
          result.message || "Contrasenya canviada correctament",
          "success",
        );
      })
      .catch((error) => {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = "Desar";
        }
        showToast(error || "Error en canviar la contrasenya", "error");
        console.error("Password change error:", error);
      });
  }

  loadMembersData() {
    const tbody = document.querySelector("#members-table tbody");
    if (tbody)
      tbody.innerHTML = '<tr><td colspan="5">Carregant membres...</td></tr>';

    API.getMembers()
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

})();




// Load members data silently for events view (without updating members table)



