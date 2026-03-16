
const DASHBOARD = new (class AppDashboardView {
  constructor() {}

  loadDashboardData() {
    // Update user display name
    document.querySelectorAll(".user-display-name").forEach(function (el) {
      el.textContent = APP.currentUser?.displayName || "Usuari";
    });

    // Load stats
    // API.getDashboardStats()
    //   .then(function (data) {
    //     document.getElementById("stat-projects").textContent = data.projects || 0;
    //     document.getElementById("stat-tasks").textContent = data.tasks || 0;
    //     document.getElementById("stat-completed").textContent =
    //       data.completed || 0;
    //     document.getElementById("stat-pending").textContent = data.pending || 0;
    //   })
    //   .catch(function (error) {
    //     console.error("Failed to load stats:", error);
    //   });

    // Load activity
    // API.getUserActivity()
    //   .then(function (activities) {
    //     const activityList = document.getElementById("activity-list");
    //     if (activities && activities.length > 0) {
    //       activityList.innerHTML = activities
    //         .map(function (activity) {
    //           return `
    //                       <div class="activity-item">
    //                       <div class="activity-icon">${activity.icon || "📝"}</div>
    //                       <div class="activity-content">
    //                           <p>${activity.description}</p>
    //                           <span class="activity-time">${formatRelativeTime(activity.timestamp)}</span>
    //                       </div>
    //                       </div>
    //                   `;
    //         })
    //         .join("");
    //     } else {
    //       activityList.innerHTML =
    //         '<p class="text-muted">No hi ha activitat recent</p>';
    //     }
    //   })
    //   .catch(function (error) {
    //     document.getElementById("activity-list").innerHTML =
    //       "<p class=\"text-muted\">No s'ha pogut carregar l'activitat</p>";
    //   });
    UI.showToast("Informació detallada no disponible al moment.", "info");
  }
})();
  
/**
 * Format relative time
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Relative time string
 */
function formatRelativeTime(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return days + " dia" + (days > 1 ? "s" : "") + " enrere";
  if (hours > 0) return hours + " hora" + (hours > 1 ? "s" : "") + " enrere";
  if (minutes > 0)
    return minutes + " minut" + (minutes > 1 ? "s" : "") + " enrere";
  return "Ara mateix";
}