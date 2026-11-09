import { attendanceFor, handleAttendanceAction, setAttendance } from "./attendance.ts";
import { handleAuthAction, handlePasswordChange } from "./auth.ts";
import { eventById, handleEventAction } from "./events.ts";
import { adminClient, failure, success, type JsonRecord } from "./infrastructure.ts";
import { notifyAllDevices } from "./integrations/firebase.ts";
import { checkFormAttendance } from "./integrations/googleSheets.ts";
import { handleMediaAction } from "./media.ts";
import { currentUser, handleMemberAction, loadMembers, memberIdForAlias, requireAdmin } from "./members.ts";
import { handleNotificationAction } from "./notifications.ts";
import { handlePositionAction } from "./positions.ts";
import { handleTrainingAction, trainingById } from "./trainings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function dispatch(request: Request, input: JsonRecord) {
  const { action, method = "GET", body = {}, parameters = {} } = input;
  if (!action || typeof action !== "string") return failure("No action specified");
  const authResult = await handleAuthAction(action, body);
  if (authResult) return authResult;

  const user = await currentUser(request);
  const adminActions = new Set([
    "members", "saveMember", "saveAllMembers", "saveEvent", "setEventVisibility",
    "saveTraining", "adminSetMemberAttendance", "calculateEventDancePositions",
    "checkFormAttendance", "sendCommunication", "changePassword",
  ]);
  if (adminActions.has(action)) await requireAdmin(user);
  const memberResult = await handleMemberAction(action, body, user);
  if (memberResult) return memberResult;
  const eventResult = await handleEventAction(action, body, parameters, { attendanceFor, notifyAllDevices });
  if (eventResult) return eventResult;
  const trainingResult = await handleTrainingAction(action, body, parameters, { attendanceFor, setAttendance });
  if (trainingResult) return trainingResult;
  const attendanceResult = await handleAttendanceAction(action, body, user, { eventById, setAttendance, trainingById });
  if (attendanceResult) return attendanceResult;
  const positionResult = await handlePositionAction(action, body, parameters, user, { loadMembers, memberIdForAlias });
  if (positionResult) return positionResult;
  const notificationResult = await handleNotificationAction(action, method, body, user);
  if (notificationResult) return notificationResult;
  if (action === "changePassword") return handlePasswordChange(body);
  const mediaResult = await handleMediaAction(action, parameters);
  if (mediaResult) return mediaResult;

  switch (action) {
    case "logout":
      return success({ message: "Session closed" });
    case "dataVersions": {
      const { data, error } = await adminClient.from("data_versions").select("name,version");
      if (error) throw error;
      return success(Object.fromEntries((data || []).map((row: JsonRecord) => [row.name, row.version])));
    }
    case "checkFormAttendance":
      return checkFormAttendance(String(parameters.spreadsheetId || ""), parameters.eventId);
    default:
      return failure(`Unknown ${input.method || "GET"} action: ${action}`, 404);
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond(failure("Method not allowed", 405), 405);
  try {
    const input = await request.json();
    const result = await dispatch(request, input);
    return respond(result, result.status || 200);
  } catch (error) {
    const status = Number((error as JsonRecord)?.status) || 500;
    console.error("Supabase API request failed:", error);
    return respond(failure((error as Error).message || "Unexpected server error", status), status);
  }
});
