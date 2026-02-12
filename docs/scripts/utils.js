function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML.replace(/"/g, "").replace(/'/g, "");
}

function showDialogWithBackdrop(dialogOrId, options = {}) {
  const dialog = typeof dialogOrId === "string" 
    ? document.getElementById(dialogOrId) 
    : dialogOrId;
  
  if (!dialog) return;
  
  // Create or get backdrop
  let backdrop = document.getElementById("dialog-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "dialog-backdrop";
    backdrop.className = "dialog-backdrop";
    document.body.appendChild(backdrop);
  }
  
  // Store reference to current dialog for close handler
  backdrop.dataset.currentDialog = dialog.id;
  
  // Close on backdrop click
  const backdropClickHandler = function(e) {
    if (e.target === backdrop) {
      closeDialogWithBackdrop(dialog);
      if (options.onClose) options.onClose();
    }
  };
  backdrop.onclick = backdropClickHandler;
  
  // Show backdrop and dialog
  backdrop.classList.add("active");
  dialog.show();
}

function closeDialogWithBackdrop(dialogOrId) {
  const dialog = typeof dialogOrId === "string" 
    ? document.getElementById(dialogOrId) 
    : dialogOrId;
  
  const backdrop = document.getElementById("dialog-backdrop");
  if (backdrop) {
    backdrop.classList.remove("active");
    backdrop.dataset.currentDialog = "";
  }
  if (dialog) dialog.close();
}

function showToast(message, type = "info") {
  // Create dialog for toast to ensure proper stacking context
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
  
  // Show dialog as modal to get into top layer, but backdrop allows clicks through
  dialog.show();
  
  // Close on backdrop click to allow interaction with page
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) {
      dialog.close();
      dialog.remove();
    }
  });

  // Trigger animation
  setTimeout(function () {
    toast.classList.add("show");
  }, 10);

  // Remove after 3 seconds
  setTimeout(function () {
    toast.classList.add("toast-remove");
    setTimeout(function () {
      dialog.close();
      dialog.remove();
    }, 300);
  }, 3000);
}

window.onerror = function (message, source, lineno, colno, error) {
  console.error("Global error:", message, error);
  showToast("S'ha produït un error. Torna-ho a provar.", "error");
  return false;
};