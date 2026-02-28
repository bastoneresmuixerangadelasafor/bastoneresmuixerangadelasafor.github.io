function calculateNextEvent() {
  CACHE.getNextEvent({forceRefresh: true});
}

function calculateNextTraining() {
  CACHE.getNextTraining({forceRefresh: true});
}

function removeExpiredSessionTokens() {
  CACHE.removeExpiredSessionTokens();
}