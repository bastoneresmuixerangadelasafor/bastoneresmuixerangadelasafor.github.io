const cache = CacheService.getScriptCache();
const scriptProps = PropertiesService.getScriptProperties();
const userProps = PropertiesService.getUserProperties();
// It's only available in container-bound scripts (scripts attached to a specific Google Sheets, Docs, Forms, or Slides file).
// const documentProps = PropertiesService.getDocumentProperties();

function html_(filename) {
  return `html/${filename}`;
}

function isDevMode_() {
  var url = ScriptApp.getService().getUrl();
  return url.indexOf('/dev') !== -1;
}

const API = class GAppsApiServer {
  constructor() {}

  static validateUserToken_({fn, token, requiresAuth = false, requiresAdmin = false}) {
    return function(...args) {
      console.log("Validating token:", token);
      const user = getUserFromSession_({ token });
      console.log("Validated user:", user);
      if(requiresAuth && !user){
        return {success: false, error: "L'operació requereix autenticació. Si us plau, inicia sessió."};
      }
      if(requiresAdmin && user?.roles?.indexOf("ADMIN") === -1){
        return {success: false, error: "L'operació requereix permisos d'administrador."};
      }
      return fn(...args);
    };
  }

  static handleApiGetRequest(e) {
    try {
      if (e.parameter?.action) {
        return GAppsApiServer.generateApiGetResponse_(e);
      }
    } catch (error) {
      console.error("Error handling GET request:", error);
      return { success: false, error: error.message };
    }
  }

  static handleApiPostRequest(e) {
    try {
      const method = e.parameter?.method?.toUpperCase() || "POST";
      switch (method) {
        case "PUT":
          return GAppsApiServer.generateApiPutResponse_(e);
        case "PATCH":
          return GAppsApiServer.generateApiPatchResponse_(e);
        case "DELETE":
          return GAppsApiServer.generateApiDeleteResponse_(e);
        default:
          return GAppsApiServer.generateApiPostResponse_(e);
      }
    } catch (error) {
      console.error("Error handling POST request:", error);
      return { success: false, error: error.message };
    }
  }

  static generateApiGetResponse_(e) {
    const action = e.parameter?.action;
    let data;
    switch (action) {
      case "user":
        const userWorker = this.validateUserToken_({fn: getCurrentUser_, requiresAuth: true, token: e.parameter?.token});
        data = userWorker({ token: e.parameter?.token });
        break;
      case "members":
        const membersWorker = this.validateUserToken_({fn: getMembers_, requiresAuth: true, requiresAdmin: true, token: e.parameter?.token});
        data = membersWorker({ forceRefresh: e.parameter?.forceRefresh });
        break;
      case "events":
        const eventsWorker = this.validateUserToken_({fn: getEvents_, requiresAuth: true, token: e.parameter?.token});
        data = eventsWorker();
        break;
      case "event":
        const eventWorker = this.validateUserToken_({fn: getEventById_, requiresAuth: true, token: e.parameter?.token});
        data = eventWorker({ eventId: e.parameter?.eventId });
        break;
      case "nextEvent":
        const nextEventWorker = this.validateUserToken_({fn: CACHE.getNextEvent, requiresAuth: true, token: e.parameter?.token});
        data = nextEventWorker();
        break;
      case "trainings":
        const trainingsWorker = this.validateUserToken_({fn: getTrainings_, requiresAuth: true, token: e.parameter?.token});
        data = trainingsWorker();
        break;
      case "training":
        const trainingWorker = this.validateUserToken_({fn: getTrainingById_, requiresAuth: true, token: e.parameter?.token});
        data = trainingWorker({ trainingId: e.parameter?.trainingId });
        break;
      case "nextTraining":
        const nextTrainingWorker = this.validateUserToken_({fn: CACHE.getNextTraining, requiresAuth: true, token: e.parameter?.token});
        data = nextTrainingWorker();
        break;
      case "audio":
        const audioWorker = this.validateUserToken_({fn: getAudioById_, requiresAuth: true, token: e.parameter?.token});
        data = audioWorker({ audioId: e.parameter?.audioId });
        break;
      default:
        return { success: false, error: `Unknown GET action: ${action}` };
    }

    console.log("Data:", data);
    return data;
  }

  static generateApiPostResponse_(e) {
    const action = e.parameter?.action;
    let data;
    switch (action) {
      case "login":
        const loginReq = JSON.parse(e.postData?.contents);
        data = loginWithEmailPassword_({
          email: loginReq?.email,
          password: loginReq?.password,
        });
        break;
      case "sendAccessLink":
        const accessLinkReq = JSON.parse(e.postData?.contents);
        data = sendAccessLink_({ email: accessLinkReq?.email });
        break;
      case "register":
        const registerReg = JSON.parse(e.postData?.contents);
        data = sendRegistrationRequest_({
          name: registerReg?.name,
          email: registerReg?.email,
        });
        break;
      case "logout":
        const logoutWorker = this.validateUserToken_({fn: logoutUser_, requiresAuth: true, token: e.parameter?.token});
        data = logoutWorker({ token: e.parameter?.token });
        break;
      default:
        return { success: false, error: `Unknown GET action: ${action}` };
    }

    return data;
  }

  static generateApiPutResponse_(e) {
    const action = e.parameter?.action;
    let data;
    switch (action) {
      case "saveMember":
        const saveMemberWorker = this.validateUserToken_({fn: saveMember_, requiresAuth: true, requiresAdmin: true, token: e.parameter?.token});
        const singleMemberRequest = JSON.parse(e.postData?.contents);
        data = saveMemberWorker({ member: singleMemberRequest?.member });
        break;
      case "saveAllMembers":
        const saveAllMemberWorker = this.validateUserToken_({fn: saveAllMembers_, requiresAuth: true, requiresAdmin: true, token: e.parameter?.token});
        const multipleMembersRequest = JSON.parse(e.postData?.contents);
        data = saveAllMemberWorker({ members: multipleMembersRequest?.members });
        break;
      case "saveEvent":
        const saveEventWorker = this.validateUserToken_({fn: saveEvent_, requiresAuth: true, requiresAdmin: true, token: e.parameter?.token});
        const eventRequest = JSON.parse(e.postData?.contents);
        data = saveEventWorker({ event: eventRequest?.event });
        break;
      default:
        return { success: false, error: `Unknown GET action: ${action}` };
    }

    return data;
  }

  static generateApiPatchResponse_(e) {
    const action = e.parameter?.action;
    let data;
    switch (action) {
      case "changePassword":
        const changePasswordWorker = this.validateUserToken_({fn: changeUserPassword_, requiresAuth: true, requiresAdmin: true, token: e.parameter?.token});
        const passwordRequest = JSON.parse(e.postData?.contents);
        data = changePasswordWorker({
          email: passwordRequest?.email,
          newPassword: passwordRequest?.newPassword,
        });
        break;
      default:
        return { success: false, error: `Unknown GET action: ${action}` };
    }

    return data;
  }

  static generateApiDeleteResponse_(e) {
    const action = e.parameter?.action;
    let data;
    switch (action) {
    }

    if (data == null) {
      return { success: false, error: `Unknown DELETE action: ${action}` };
    }

    return data;
  }
};

doGet = (e) => {
  if (e.parameter?.action) {
    const data = API.handleApiGetRequest(e);
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
      ContentService.MimeType.JSON,
    );
  }

  const path = e.pathInfo || "/";
  console.log("Webpage path:", path);
  switch (path) {
    case "/":
      if (isDevMode_())
        return HtmlService.createTemplateFromFile(html_("test"))
          .evaluate()
          .setTitle("PLAYGROUND - Development")
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
          .addMetaTag("viewport", "width=device-width, initial-scale=1");
    case "test":
      if (isDevMode_())
        return HtmlService.createTemplateFromFile(html_("benchmark"))
          .evaluate()
          .setTitle("TEST SUITE - Development")
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
          .addMetaTag("viewport", "width=device-width, initial-scale=1");
    case "player":
      if (isDevMode_()){
        const fileId = e.parameter?.audioId;
        if(fileId){    
          try{
            const file = DriveApp.getFileById(fileId);
            const blob = file.getBlob();
            const base64Data = Utilities.base64Encode(blob.getBytes());
            // const mimeType = blob.getContentType();
            const template = HtmlService.createTemplateFromFile(html_("player"));
            template.audioData = 'data:audio/mpeg;base64,' + base64Data;
            
            return template.evaluate()
            .setTitle("Reproductor d'Àudio")
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
            .addMetaTag("viewport", "width=device-width, initial-scale=1");
          } catch (error){
            console.error("Error loading audio file:", error);
          }
        }
        return HtmlService.createHtmlOutput("<h1>Error: No s'ha trobat cap fitxer d'àudio</h1>").setTitle("Error");
      }
      break;
  }
  return HtmlService.createHtmlOutput("<h1>404: Page Not Found</h1>").setTitle(
    "404 Not Found",
  );
};
doPost = (e) => {
  const data = API.handleApiPostRequest(e);
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
};

function test({ action, method = "GET", body = null, parameters } = {}) {
  console.log({ action, method, body, parameters });
  const e = {
    parameter: { action, method, ...parameters },
    postData: { contents: JSON.stringify(body) },
  };
  switch (method.toUpperCase()) {
    case "GET":
      return API.handleApiGetRequest(e);
    case "POST":
    case "PUT":
    case "PATCH":
    case "DELETE":
      return API.handleApiPostRequest(e);
  }
}
