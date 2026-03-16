const UI = new (class AppUIManager {
  constructor() {
    window.onerror = (message, source, lineno, colno, error) => {
      console.error("Global error:", message, error);
      this.showToast("S'ha produït un error. Torna-ho a provar.", "error");
      return false;
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this._initValidationMessages();
        this._initButtonFeedback();
      });
    } else {
      this._initValidationMessages();
      this._initButtonFeedback();
    }

    const btnObserver = new MutationObserver(function (mutations) {
      var shouldInit = false;
      mutations.forEach(function (mutation) {
        if (mutation.addedNodes.length > 0) {
          shouldInit = true;
        }
      });
      if (shouldInit) {
        this._initButtonFeedback();
      }
    }.bind(this));

    btnObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });

    const inputObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            if (node.matches && node.matches("input, select, textarea")) {
              this._setCustomValidationMessages(node);
            }
            var childInputs =
              node.querySelectorAll &&
              node.querySelectorAll("input, select, textarea");
            if (childInputs) {
              childInputs.forEach(this._setCustomValidationMessages.bind(this));
            }
          }
        }.bind(this));
      }.bind(this));
    }.bind(this));

    inputObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  _initButtonFeedback() {
    const buttons = document.querySelectorAll(
      'button, .btn, [role="button"], .dance-chip, .collapsible-toggle, .refresh-event-btn',
    );

    buttons.forEach(function (button) {
      if (button.dataset.rippleInit) return;
      button.dataset.rippleInit = "true";

      const computedStyle = window.getComputedStyle(button);
      if (computedStyle.position === "static") {
        button.style.position = "relative";
      }
      button.style.overflow = "hidden";

      button.addEventListener("click", this._createRipple.bind(this));
    }.bind(this));
  }

  _initValidationMessages() {
    var inputs = document.querySelectorAll("input, select, textarea");
    inputs.forEach(this._setCustomValidationMessages.bind(this));
  }

  _createRipple(event) {
    const button = event.currentTarget;

    if (button.disabled) return;

    const ripple = document.createElement("span");
    ripple.className = "btn-ripple";

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";

    button.appendChild(ripple);

    ripple.addEventListener("animationend", function () {
      ripple.remove();
    });
  }

  _setCustomValidationMessages(input) {
    input.addEventListener("invalid", function (e) {
      e.target.setCustomValidity("");
      if (!e.target.validity.valid) {
        if (e.target.validity.valueMissing) {
          e.target.setCustomValidity("Aquest camp és obligatori.");
        } else if (e.target.validity.typeMismatch) {
          if (e.target.type === "email") {
            e.target.setCustomValidity(
              "Introdueix una adreça de correu electrònic vàlida.",
            );
          } else if (e.target.type === "url") {
            e.target.setCustomValidity("Introdueix una URL vàlida.");
          } else {
            e.target.setCustomValidity("El format no és vàlid.");
          }
        } else if (e.target.validity.tooShort) {
          e.target.setCustomValidity(
            "Mínim " + e.target.minLength + " caràcters.",
          );
        } else if (e.target.validity.tooLong) {
          e.target.setCustomValidity(
            "Màxim " + e.target.maxLength + " caràcters.",
          );
        } else if (e.target.validity.rangeUnderflow) {
          e.target.setCustomValidity(
            "El valor ha de ser " + e.target.min + " o superior.",
          );
        } else if (e.target.validity.rangeOverflow) {
          e.target.setCustomValidity(
            "El valor ha de ser " + e.target.max + " o inferior.",
          );
        } else if (e.target.validity.patternMismatch) {
          e.target.setCustomValidity(
            e.target.title || "El format no és vàlid.",
          );
        } else if (e.target.validity.stepMismatch) {
          e.target.setCustomValidity("El valor no és vàlid.");
        } else if (e.target.validity.badInput) {
          e.target.setCustomValidity("Introdueix un valor vàlid.");
        }
      }
    });
  
    input.addEventListener("input", function (e) {
      e.target.setCustomValidity("");
    });
  }

  showDialogWithBackdrop(dialogOrId, options = {}) {
    const dialog = typeof dialogOrId === "string" 
      ? document.getElementById(dialogOrId) 
      : dialogOrId;
    
    if (!dialog) return;
    
    if (dialog.open) {
      dialog.close();
    }
    
    let backdrop = document.getElementById("dialog-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "dialog-backdrop";
      backdrop.className = "dialog-backdrop";
      document.body.appendChild(backdrop);
    }
    
    backdrop.dataset.currentDialog = dialog.id;
    
    const backdropClickHandler = function(e) {
      if (e.target === backdrop) {
        e.stopPropagation();
        e.preventDefault();
        this.closeDialogWithBackdrop(dialog);
        if (options.onClose) options.onClose();
      }
    }.bind(this);
    backdrop.onclick = backdropClickHandler;
    
    backdrop.classList.add("active");
    
    setTimeout(function() {
      dialog.show();
    }, 10);
  }

  closeDialogWithBackdrop(dialogOrId) {
    const dialog = typeof dialogOrId === "string" 
      ? document.getElementById(dialogOrId) 
      : dialogOrId;
    
    const backdrop = document.getElementById("dialog-backdrop");
    if (backdrop) {
      backdrop.classList.remove("active");
      backdrop.dataset.currentDialog = "";
      backdrop.onclick = null;
    }
    if (dialog) {
      dialog.close();
    }
  }

  showToast(message, type = "info") {
    const dialog = document.createElement("dialog");
    dialog.className = "toast-dialog";
    dialog.style.zIndex = 9999;
    
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    };
    
    toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    `;
    
    dialog.appendChild(toast);
    document.body.appendChild(dialog);
    
    dialog.show();
    
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) {
        dialog.close();
        dialog.remove();
      }
    });

    setTimeout(function () {
      toast.classList.add("show");
    }, 10);

    setTimeout(function () {
      toast.classList.add("toast-remove");
      setTimeout(function () {
        dialog.close();
        dialog.remove();
      }, 300);
    }, 3000);
  }
})();
