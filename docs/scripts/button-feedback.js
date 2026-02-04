// Button click visual feedback with ripple effect
(function () {
  "use strict";

  // Add ripple effect to buttons on click
  function createRipple(event) {
    const button = event.currentTarget;

    // Skip if button is disabled
    if (button.disabled) return;

    // Create ripple element
    const ripple = document.createElement("span");
    ripple.className = "btn-ripple";

    // Calculate ripple size and position
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";

    // Add ripple to button
    button.appendChild(ripple);

    // Remove ripple after animation completes
    ripple.addEventListener("animationend", function () {
      ripple.remove();
    });
  }

  // Apply ripple effect to all buttons
  function initButtonFeedback() {
    const buttons = document.querySelectorAll(
      'button, .btn, [role="button"], .dance-chip, .event-card-btn, .collapsible-toggle, .refresh-event-btn',
    );

    buttons.forEach(function (button) {
      // Skip if already initialized
      if (button.dataset.rippleInit) return;
      button.dataset.rippleInit = "true";

      // Ensure button has relative positioning for ripple
      const computedStyle = window.getComputedStyle(button);
      if (computedStyle.position === "static") {
        button.style.position = "relative";
      }
      button.style.overflow = "hidden";

      button.addEventListener("click", createRipple);
    });
  }

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initButtonFeedback);
  } else {
    initButtonFeedback();
  }

  // Also observe for dynamically added buttons
  var observer = new MutationObserver(function (mutations) {
    var shouldInit = false;
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length > 0) {
        shouldInit = true;
      }
    });
    if (shouldInit) {
      initButtonFeedback();
    }
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
