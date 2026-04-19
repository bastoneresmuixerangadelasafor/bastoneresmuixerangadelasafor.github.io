function getServiceAccountToken_() {
  const scriptProps = PropertiesService.getScriptProperties();
  const clientEmail = scriptProps.getProperty('FCM_CLIENT_EMAIL');
  const privateKey = scriptProps.getProperty('FCM_PRIVATE_KEY').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=+$/, '');
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).replace(/=+$/, '');

  const signingInput = header + '.' + payload;
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(signingInput, privateKey)
  ).replace(/=+$/, '');

  const jwt = signingInput + '.' + signature;

  const tokenResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    payload: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
    muteHttpExceptions: true,
  });

  const tokenData = JSON.parse(tokenResponse.getContentText());
  return tokenData.access_token;
}

function sendFcmToToken_(token, notification) {
  const accessToken = getServiceAccountToken_();
  const message = {
    message: {
      token: token,
      data: {
        title: notification.title,
        body: notification.body,
      },
      webpush: {
        fcm_options: {
          link: WEBSITE_URL,
        },
      },
    },
  };

  const response = UrlFetchApp.fetch(
    'https://fcm.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID + '/messages:send',
    {
      method: 'POST',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + accessToken },
      payload: JSON.stringify(message),
      muteHttpExceptions: true,
    }
  );

  const status = response.getResponseCode();
  if (status === 404 || status === 410) {
    CACHE.removePushToken(token);
  }
}

function broadcastNotification_(notification) {
  const tokenMap = CACHE.getPushTokens();
  const sentTokens = {};
  for (const userId in tokenMap) {
    const userTokens = tokenMap[userId];
    if (!Array.isArray(userTokens)) continue;
    userTokens.forEach(function(token) {
      if (sentTokens[token]) return;
      sentTokens[token] = true;
      try {
        sendFcmToToken_(token, notification);
      } catch (e) {
        console.error('Error sending FCM to token: ' + e.toString());
      }
    });
  }
}

function notifyTrainingCreated(training) {
  const dateStr = training.date ? training.date.replace('T', ' ').substring(0, 16) : '';
  broadcastNotification_({
    title: 'Nou assaig programat',
    body: dateStr ? 'Assaig el ' + dateStr : 'S\'ha programat un nou assaig',
  });
}

function notifyEventCreated(event) {
  const dateStr = event.date ? event.date.replace('T', ' ').substring(0, 16) : '';
  const name = event.name || 'nou acte';
  broadcastNotification_({
    title: 'Nou acte programat',
    body: name + (dateStr ? ' · ' + dateStr : ''),
  });
}

function notifyUpcomingTraining(training) {
  const dateStr = training.date ? training.date.replace('T', ' ').substring(11, 16) : '';
  broadcastNotification_({
    title: 'Assaig demà!',
    body: dateStr ? 'Recordatori: assaig demà a les ' + dateStr : 'Recordatori: tens un assaig demà',
  });
}

function notifyUpcomingEvent(event) {
  const name = event.name || 'l\'acte';
  broadcastNotification_({
    title: 'Acte demà!',
    body: 'Recordatori: ' + name + ' és demà',
  });
}

function sendCommunication_({ title, message }) {
  const tokenMap = CACHE.getPushTokens();
  const tokenCount = Object.keys(tokenMap).reduce(function(count, userId) {
    var userTokens = tokenMap[userId];
    return count + (Array.isArray(userTokens) ? userTokens.length : 0);
  }, 0);
  if (tokenCount === 0) {
    return { sent: 0, failed: 0, total: 0 };
  }
  var sent = 0;
  var failed = 0;
  var sentTokens = {};
  for (var userId in tokenMap) {
    var userTokens = tokenMap[userId];
    if (!Array.isArray(userTokens)) continue;
    userTokens.forEach(function(token) {
      if (sentTokens[token]) return;
      sentTokens[token] = true;
      try {
        sendFcmToToken_(token, { title: title, body: message });
        sent++;
      } catch (e) {
        failed++;
        console.error('Error sending communication to token: ' + e.toString());
      }
    });
  }
  return { sent: sent, failed: failed, total: sent + failed };
}
