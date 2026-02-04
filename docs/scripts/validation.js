// Custom Catalan validation messages for all form inputs
(function () {
  function setCustomValidationMessages(input) {
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

  function initValidationMessages() {
    var inputs = document.querySelectorAll("input, select, textarea");
    inputs.forEach(setCustomValidationMessages);
  }

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initValidationMessages);
  } else {
    initValidationMessages();
  }

  // Also observe for dynamically added inputs
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) {
          if (node.matches && node.matches("input, select, textarea")) {
            setCustomValidationMessages(node);
          }
          var childInputs =
            node.querySelectorAll &&
            node.querySelectorAll("input, select, textarea");
          if (childInputs) {
            childInputs.forEach(setCustomValidationMessages);
          }
        }
      });
    });
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
