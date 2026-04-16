function calculateNextEvent() {
  CACHE.getNextEvent({forceRefresh: true});
}

function calculateNextTraining() {
  CACHE.getNextTraining({forceRefresh: true});
}

function removeExpiredSessionTokens() {
  CACHE.removeExpiredSessionTokens();
}

function sendUpcomingReminders() {
  const now = new Date();
  const minMs = 18 * 60 * 60 * 1000;
  const maxMs = 30 * 60 * 60 * 1000;

  const nextTrainingResult = CACHE.getNextTraining();
  const nextTrainingDate = nextTrainingResult?.result?.trainingData;
  if (nextTrainingDate) {
    const diff = new Date(nextTrainingDate) - now;
    if (diff >= minMs && diff <= maxMs) {
      try {
        notifyUpcomingTraining({ date: nextTrainingDate });
      } catch (e) {
        console.error('Error sending upcoming training reminder: ' + e.toString());
      }
    }
  }

  const nextEventResult = CACHE.getNextEvent();
  const nextEventDate = nextEventResult?.result?.eventData;
  if (nextEventDate) {
    const diff = new Date(nextEventDate) - now;
    if (diff >= minMs && diff <= maxMs) {
      try {
        const events = CACHE.getEvents();
        const nextEvent = events.find(function(ev) { return ev.date === nextEventDate; });
        notifyUpcomingEvent({ name: nextEvent?.name || '', date: nextEventDate });
      } catch (e) {
        console.error('Error sending upcoming event reminder: ' + e.toString());
      }
    }
  }
}