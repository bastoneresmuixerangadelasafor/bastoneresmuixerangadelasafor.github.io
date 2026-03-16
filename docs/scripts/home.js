const HOME = new (class AppLandingView{
  constructor() {
  }

  loadHomeData() {
    const userNameEl = document.getElementById("home-user-name");
    if (userNameEl) {
      if (APP.currentUser && APP.currentUser.displayName) {
        const names = [APP.currentUser.displayName];
        const relations = APP.currentUser.relatedMembers || [];
        if (relations.length > 0) {
          names.push(...relations.map((rel) => rel.name || rel.name).filter(Boolean));
        }
        userNameEl.textContent = MEMBERS.formatNamesList(names);
      } else {
        userNameEl.textContent = "";
      }
    }
  
    const nextEventTextEl = document.getElementById("next-event-text");
    if (nextEventTextEl && APP.isAuthenticated) {
      API.getNextEvent()
        .then(function (result) {
          if (result && result.eventData) {
            nextEventTextEl.textContent = EVENTS.formatEventDate(result.eventData);
          } else {
            nextEventTextEl.textContent = "Sense proper esdeveniment programat";
          }
        })
        .catch(function (error) {
          console.error("Error loading next event:", error);
          nextEventTextEl.textContent = "Error carregant dades";
        });
    }
  
    const nextTrainingTextEl = document.getElementById("next-training-text");
    if (nextTrainingTextEl && APP.isAuthenticated) {
      API.getNextTraining()
        .then(function (result) {
          if (result && result.trainingData) {
            nextTrainingTextEl.textContent = EVENTS.formatEventDate(result.trainingData);
          } else {
            nextTrainingTextEl.textContent = "Sense proper assaig programat";
          }
        })
        .catch(function (error) {
          console.error("Error loading next training:", error);
          nextTrainingTextEl.textContent = "Error carregant dades";
        });
    }
  }
})();