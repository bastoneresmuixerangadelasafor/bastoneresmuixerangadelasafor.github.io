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

  static newResult_({ result }) {
    return { success: true, status: 200, result };
  }

  static newError_({ error, status = 500 }) {
    return { success: false, status, error };
  }

  static validateUserToken_({fn, token, requiresAuth = false, requiresAdmin = false}) {
    return function(...args) {
      console.log("Validating token:", token);
      const user = getUserFromSession_({ token });
      
      if(requiresAuth && !user){
        return API.newError_({ error: "L'operació requereix autenticació. Si us plau, inicia sessió.", status: 401 });
      }
      if(requiresAdmin){
        const member = CACHE.getMembers().find(function (m) {
          return m.email && m.email.toLowerCase() === user.email.toLowerCase();
        });
        const freshRoles = member?.roles || [];
        if(freshRoles.indexOf("ADMIN") === -1){
          return API.newError_({ error: "L'operació requereix permisos d'administrador.", status: 403 });
        }
      }
      const params = args.length > 0 ? args[0] : {};
      return fn({ ...params, user });
    };
  }

  static handleApiGetRequest(e) {
    try {
      if (e.parameter?.action) {
        return GAppsApiServer.generateApiGetResponse_(e);
      }
    } catch (error) {
      console.error("Error handling GET request:", error);
      return API.newError_({ error: error.message });
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
      return API.newError_({ error: error.message, status: 405 });
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
        data = eventsWorker({ forceRefresh: e.parameter?.forceRefresh });
        break;
      case "event":
        const eventWorker = this.validateUserToken_({fn: getEventById_, requiresAuth: true, token: e.parameter?.token});
        data = eventWorker({ eventId: e.parameter?.eventId });
        break;
      case "nextEvent":
        const nextEventWorker = this.validateUserToken_({fn: (args) => CACHE.getNextEvent(args), requiresAuth: true, token: e.parameter?.token});
        data = nextEventWorker();
        break;
      case "trainings":
        const trainingsWorker = this.validateUserToken_({fn: getTrainings_, requiresAuth: true, token: e.parameter?.token});
        data = trainingsWorker({ forceRefresh: e.parameter?.forceRefresh });
        break;
      case "training":
        const trainingWorker = this.validateUserToken_({fn: getTrainingById_, requiresAuth: true, token: e.parameter?.token});
        data = trainingWorker({ trainingId: e.parameter?.trainingId });
        break;
      case "nextTraining":
        const nextTrainingWorker = this.validateUserToken_({fn: (args) => CACHE.getNextTraining(args), requiresAuth: true, token: e.parameter?.token});
        data = nextTrainingWorker();
        break;
      case "audio":
        const audioWorker = this.validateUserToken_({fn: getAudioById_, requiresAuth: true, token: e.parameter?.token});
        data = audioWorker({ audioId: e.parameter?.audioId });
        break;
      case "memberPositions":
        const memberPositionsWorker = this.validateUserToken_({fn: getMemberPositions_, requiresAuth: true, token: e.parameter?.token});
        data = memberPositionsWorker({ memberAlias: e.parameter?.memberAlias });
        break;
      case "dataVersions":
        const versionsWorker = this.validateUserToken_({fn: () => API.newResult_({ result: CACHE.getDataVersions() }), requiresAuth: true, token: e.parameter?.token});
        data = versionsWorker();
        break;
      default:
        return API.newError_({ error: `Unknown GET action: ${action}`, status:404 });
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
      case "confirmTrainingAttendance":
        const confirmAttendanceWorker = this.validateUserToken_({fn: confirmTrainingAttendance_, requiresAuth: true, token: e.parameter?.token});
        const confirmAttendanceReq = JSON.parse(e.postData?.contents);
        data = confirmAttendanceWorker({ trainingId: confirmAttendanceReq?.trainingId, token: e.parameter?.token });
        break;
      case "cancelTrainingAttendance":
        const cancelAttendanceWorker = this.validateUserToken_({fn: cancelTrainingAttendance_, requiresAuth: true, token: e.parameter?.token});
        const cancelAttendanceReq = JSON.parse(e.postData?.contents);
        data = cancelAttendanceWorker({ trainingId: cancelAttendanceReq?.trainingId, token: e.parameter?.token });
        break;
      case "confirmRelatedMemberAttendance":
        const confirmRelatedWorker = this.validateUserToken_({fn: confirmRelatedMemberAttendance_, requiresAuth: true, token: e.parameter?.token});
        const confirmRelatedReq = JSON.parse(e.postData?.contents);
        data = confirmRelatedWorker({ trainingId: confirmRelatedReq?.trainingId, memberId: confirmRelatedReq?.memberId, memberAlias: confirmRelatedReq?.memberAlias, token: e.parameter?.token });
        break;
      case "cancelRelatedMemberAttendance":
        const cancelRelatedWorker = this.validateUserToken_({fn: cancelRelatedMemberAttendance_, requiresAuth: true, token: e.parameter?.token});
        const cancelRelatedReq = JSON.parse(e.postData?.contents);
        data = cancelRelatedWorker({ trainingId: cancelRelatedReq?.trainingId, memberId: cancelRelatedReq?.memberId, memberAlias: cancelRelatedReq?.memberAlias, token: e.parameter?.token });
        break;
      case "adminSetMemberAttendance":
        const adminSetAttendanceWorker = this.validateUserToken_({fn: adminSetMemberAttendance_, requiresAuth: true, requiresAdmin: true, token: e.parameter?.token});
        const adminSetAttendanceReq = JSON.parse(e.postData?.contents);
        data = adminSetAttendanceWorker({ trainingId: adminSetAttendanceReq?.trainingId, memberAlias: adminSetAttendanceReq?.memberAlias, attending: adminSetAttendanceReq?.attending });
        break;
      case "confirmEventMemberAttendance":
        const adminSetEventAttendanceWorker = this.validateUserToken_({fn: confirmEventMemberAttendance_, requiresAuth: true, requiresAdmin: true, token: e.parameter?.token});
        const adminSetEventAttendanceReq = JSON.parse(e.postData?.contents);
        data = adminSetEventAttendanceWorker({ eventId: adminSetEventAttendanceReq?.eventId, memberAlias: adminSetEventAttendanceReq?.memberAlias, attending: adminSetEventAttendanceReq?.attending });
        break;
      case "saveTrainingNote":
        const saveNoteWorker = this.validateUserToken_({fn: saveTrainingNote_, requiresAuth: true, token: e.parameter?.token});
        const saveNoteReq = JSON.parse(e.postData?.contents);
        data = saveNoteWorker({ trainingId: saveNoteReq?.trainingId, note: saveNoteReq?.note, token: e.parameter?.token });
        break;
      case "saveRelatedMemberTrainingNote":
        const saveRelatedNoteWorker = this.validateUserToken_({fn: saveRelatedMemberTrainingNote_, requiresAuth: true, token: e.parameter?.token});
        const saveRelatedNoteReq = JSON.parse(e.postData?.contents);
        data = saveRelatedNoteWorker({ trainingId: saveRelatedNoteReq?.trainingId, memberId: saveRelatedNoteReq?.memberId, memberAlias: saveRelatedNoteReq?.memberAlias, note: saveRelatedNoteReq?.note, token: e.parameter?.token });
        break;
      case "registerPushToken":
        const registerPushWorker = this.validateUserToken_({fn: ({user}) => {
          const req = JSON.parse(e.postData?.contents);
          CACHE.savePushToken({ userId: user.email, token: req?.pushToken });
          return API.newResult_({ result: { status: 'saved' } });
        }, requiresAuth: true, token: e.parameter?.token});
        data = registerPushWorker();
        break;
      case "sendCommunication":
        const sendCommWorker = this.validateUserToken_({fn: ({user}) => {
          const req = JSON.parse(e.postData?.contents);
          if (!req?.title || !req?.message) {
            return API.newError_({ error: "El títol i el missatge són obligatoris.", status: 400 });
          }
          try {
            const result = sendCommunication_({ title: req.title, message: req.message, recipientUserIds: req.recipientUserIds });
            if (result.total === 0) {
              return API.newError_({ error: "No hi ha cap dispositiu registrat per a rebre notificacions.", status: 404 });
            }
            return API.newResult_({ result: result });
          } catch (err) {
            console.error("Error in sendCommunication:", err);
            return API.newError_({ error: "Error enviant el comunicat: " + err.message, status: 500 });
          }
        }, requiresAuth: true, requiresAdmin: true, token: e.parameter?.token});
        data = sendCommWorker();
        break;
      default:
        return API.newError_({ error: `Unknown POST action: ${action}`, status:404 });
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
      case "saveTraining":
        const saveTrainingWorker = this.validateUserToken_({fn: saveTraining_, requiresAuth: true, requiresAdmin: true, token: e.parameter?.token});
        const trainingRequest = JSON.parse(e.postData?.contents);
        data = saveTrainingWorker({ training: trainingRequest?.training });
        break;
      default:
        return API.newError_({ error: `Unknown PUT action: ${action}`, status:404 });
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
      case "updateMemberPosition":
        const updatePositionWorker = this.validateUserToken_({fn: updateMemberPosition_, requiresAuth: true, token: e.parameter?.token});
        const positionRequest = JSON.parse(e.postData?.contents);
        data = updatePositionWorker({
          memberAlias: positionRequest?.memberAlias,
          danceName: positionRequest?.danceName,
          positionOrder: positionRequest?.positionOrder,
          value: positionRequest?.value,
        });
        break;
      default:
        return API.newError_({ error: `Unknown PATCH action: ${action}`, status:404 });
    }

    return data;
  }

  static generateApiDeleteResponse_(e) {
    const action = e.parameter?.action;
    let data;
    switch (action) {
      case "registerPushToken":
        const removePushWorker = this.validateUserToken_({fn: () => {
          const req = JSON.parse(e.postData?.contents);
          CACHE.removePushToken(req?.pushToken);
          return API.newResult_({ result: { status: 'removed' } });
        }, requiresAuth: true, token: e.parameter?.token});
        data = removePushWorker();
        break;
    }

    if (data == null) {
      return API.newError_({ error: `Unknown DELETE action: ${action}`, status:404 });
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
