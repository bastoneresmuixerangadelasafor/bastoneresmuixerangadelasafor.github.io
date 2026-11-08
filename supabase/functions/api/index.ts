import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, any>;

function respond(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function serviceAccountAccessToken(secretName: string, scope: string) {
  const rawAccount = Deno.env.get(secretName);
  if (!rawAccount) throw new Error(`${secretName} is not configured`);
  const account = JSON.parse(rawAccount);
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: account.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const input = `${header}.${payload}`;
  const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input)));
  const assertion = `${input}.${base64Url(signature)}`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error(tokenData.error_description || "Could not obtain Firebase access token");
  return tokenData.access_token as string;
}

function firebaseAccessToken() {
  return serviceAccountAccessToken("FCM_SERVICE_ACCOUNT_JSON", "https://www.googleapis.com/auth/firebase.messaging");
}

async function checkFormAttendance(spreadsheetId: string, eventId: string | undefined) {
  if (!spreadsheetId || !/^[A-Za-z0-9_-]+$/.test(spreadsheetId)) {
    return failure("Invalid spreadsheet ID", 400);
  }
  const accessToken = await serviceAccountAccessToken(
    "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  );
  const headers = { Authorization: `Bearer ${accessToken}` };
  const metadataResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers },
  );
  const metadata = await metadataResponse.json();
  if (!metadataResponse.ok) {
    const status = metadataResponse.status === 403 ? 403 : 400;
    return { ...failure("Could not read the response spreadsheet", status), technicalDetails: metadata.error?.message || "" };
  }
  const sheetName = metadata.sheets?.[0]?.properties?.title;
  if (!sheetName) return failure("The response spreadsheet has no sheets", 400);
  const range = encodeURIComponent(`'${sheetName.replace(/'/g, "''")}'!A:ZZ`);
  const valuesResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers },
  );
  const valuesData = await valuesResponse.json();
  if (!valuesResponse.ok) {
    return { ...failure("Could not read the response spreadsheet", 400), technicalDetails: valuesData.error?.message || "" };
  }
  const values = valuesData.values || [];
  if (values.length < 2) return success([]);
  const columns = values[0].map((value: unknown) => String(value).toLowerCase().trim());
  const nameIndex = columns.indexOf("nom");
  const participationIndex = columns.findIndex((value: string) => value.includes("en què participes"));
  const relatedIndex = columns.findIndex((value: string) => value.includes("apunta") && value.includes("nom"));
  if (nameIndex < 0 || participationIndex < 0) return failure('Missing "Nom" or participation columns', 400);
  const members = (await loadMembers()).filter((member: JsonRecord) => member.active !== false);
  let eventAttendees: string[] = [];
  if (eventId && eventId !== "null" && eventId !== "undefined") {
    try {
      eventAttendees = (await eventById(eventId)).attendees || [];
    } catch (error) {
      if ((error as JsonRecord).status !== 404) throw error;
    }
  }
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const matchName = (rawName: string, saysYes: boolean) => {
    const formName = String(rawName || "").trim();
    if (!formName) return null;
    const normalized = normalize(formName);
    const member = members.find((item: JsonRecord) =>
      normalize(item.name || "") === normalized || normalize(item.alias || "") === normalized
    ) || members.find((item: JsonRecord) => {
      const name = normalize(item.name || "");
      const alias = normalize(item.alias || "");
      return name.includes(normalized) || normalized.includes(name)
        || (alias && (alias.includes(normalized) || normalized.includes(alias)));
    });
    const alias = member?.alias || "";
    const confirmed = eventAttendees.includes(alias);
    return {
      formName,
      memberAlias: member ? alias : null,
      memberName: member ? member.name : null,
      matched: Boolean(member),
      formAttendance: saysYes ? "yes" : "no",
      attendanceMismatch: member && eventId && saysYes !== confirmed
        ? saysYes ? "form_yes_app_no" : "form_no_app_yes"
        : null,
    };
  };
  const matches = [];
  for (const row of values.slice(1)) {
    if (!String(row[participationIndex] || "").toLowerCase().includes("ball de bastons")) continue;
    const saysYes = String(row[2] || "").trim().length > 0
      && String(row[2] || "").trim().toLowerCase() !== "no";
    const main = matchName(String(row[nameIndex] || ""), saysYes);
    if (main) matches.push(main);
    if (relatedIndex >= 0 && row[relatedIndex]) {
      const names = String(row[relatedIndex]).split(/\s*,\s*|\s*;\s*|\s*\/\s*|\s+i\s+|\s+y\s+|\s*&\s*|\n/i);
      for (const related of names) {
        const match = matchName(related.trim(), saysYes);
        if (match) matches.push({ ...match, relatedTo: String(row[nameIndex] || "").trim() });
      }
    }
  }
  return success(matches);
}

async function notifyAllDevices(title: string, message: string) {
  const { data: rows, error } = await adminClient.from("push_tokens").select("token");
  if (error) throw error;
  const tokens = [...new Set((rows || []).map((row) => row.token))];
  if (!tokens.length) return;
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is not configured");
  const accessToken = await firebaseAccessToken();
  for (const token of tokens) {
    try {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            data: { title, body: message },
            webpush: { fcm_options: { link: Deno.env.get("WEBSITE_URL") || "/" } },
          },
        }),
      });
      if (!response.ok) {
        const responseBody = await response.text();
        if (response.status === 404 || response.status === 410 || responseBody.includes("UNREGISTERED")) {
          const { error: deleteError } = await adminClient.from("push_tokens").delete().eq("token", token);
          if (deleteError) console.error("Could not remove invalid push token:", deleteError.message);
        }
      }
    } catch (error) {
      console.error("Push delivery failed:", (error as Error).message);
    }
  }
}

function success(result: unknown) {
  return { success: true, status: 200, result };
}

function failure(error: string, status = 400) {
  return { success: false, status, error };
}

function avatar(name: string, roles: string[] = []) {
  const background = roles.includes("ADMIN") ? "000000" : "667eea";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}&background=${background}&color=fff&size=128`;
}

async function loadMembers() {
  const { data, error } = await adminClient.from("members").select("id,email,alias,name,type,roles,active").range(0, 9999);
  if (error) throw error;
  const { data: relations, error: relationError } = await adminClient.from("member_relations")
    .select("member_id,related_member_id,position").order("position").range(0, 9999);
  if (relationError) throw relationError;
  return (data || []).map((row) => ({
    ...row,
    email: row.email || "",
    relations: (relations || []).filter((relation) => relation.member_id === row.id)
      .map((relation) => relation.related_member_id),
  }));
}

async function memberRelations(memberId: string) {
  const { data, error } = await adminClient.from("member_relations")
    .select("related_member_id").eq("member_id", memberId).order("position");
  if (error) throw error;
  return (data || []).map((row) => String(row.related_member_id));
}

async function bumpVersion(name: string) {
  const { error } = await adminClient.from("data_versions").upsert({ name, version: Date.now() });
  if (error) throw error;
}

async function currentUser(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Authentication required"), { status: 401 });
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user?.email) {
    throw Object.assign(new Error("Authentication required"), { status: 401 });
  }
  const { data: row, error } = await adminClient.from("members")
    .select("id,email,alias,name,type,roles,active").ilike("email", authData.user.email).limit(1).maybeSingle();
  if (error) throw error;
  if (!row || row.active === false) {
    throw Object.assign(new Error("No active member is linked to this account"), { status: 403 });
  }
  const member = row;
  return {
    authUser: authData.user,
    member,
    email: authData.user.email,
    alias: member.alias || member.name,
    roles: member.roles || [],
    relations: await memberRelations(String(member.id)),
    memberId: String(member.id),
  };
}

async function requireAdmin(user: JsonRecord) {
  if (!user.roles.includes("ADMIN")) {
    throw Object.assign(new Error("Administrator permissions are required"), { status: 403 });
  }
}

async function relatedMember(user: JsonRecord, memberId: string, alias: string) {
  if (!user.relations.includes(String(memberId))) {
    throw Object.assign(new Error("You cannot manage this related member"), { status: 403 });
  }
  const { data, error } = await adminClient.from("members")
    .select("id,email,alias,name,type,roles,active").eq("id", String(memberId)).maybeSingle();
  if (error) throw error;
  if (!data || String(data.alias || "").toLowerCase() !== String(alias || "").toLowerCase()) {
    throw Object.assign(new Error("Related member does not match"), { status: 403 });
  }
  return data;
}

async function memberIdForAlias(alias: string) {
  const { data, error } = await adminClient.from("members")
    .select("id").ilike("alias", alias).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error(`Member not found: ${alias}`), { status: 404 });
  return String(data.id);
}

async function attendanceFor(entityType: string, ids: string[]) {
  if (!ids.length) return new Map();
  const table = entityType === "event" ? "event_attendance" : "training_attendance";
  const key = entityType === "event" ? "event_id" : "training_id";
  const { data, error } = await adminClient.from(table)
    .select(`${key},member_id,attending,note,members!inner(alias)`).in(key, ids);
  if (error) throw error;
  const grouped = new Map<string, JsonRecord>();
  for (const row of data || []) {
    const item = grouped.get(row[key]) || { attendees: [], rejections: [], notes: {} };
    const alias = row.members.alias;
    if (row.attending === true) item.attendees.push(alias);
    if (row.attending === false) item.rejections.push(alias);
    if (row.note) item.notes[alias] = row.note;
    grouped.set(row[key], item);
  }
  return grouped;
}

async function setAttendance(entityType: string, entityId: string, alias: string, attending?: boolean | null, note?: string | null) {
  const table = entityType === "event" ? "event_attendance" : "training_attendance";
  const key = entityType === "event" ? "event_id" : "training_id";
  const memberId = await memberIdForAlias(alias);
  const { data: existing, error: readError } = await adminClient.from(table)
    .select("attending,note").eq(key, entityId).eq("member_id", memberId).maybeSingle();
  if (readError) throw readError;
  const nextStatus = attending === undefined ? existing?.attending ?? null : attending;
  const nextNote = note === undefined ? existing?.note ?? null : note;
  if (nextStatus === null && nextNote === null) {
    const { error } = await adminClient.from(table).delete().eq(key, entityId).eq("member_id", memberId);
    if (error) throw error;
    await bumpVersion(entityType === "event" ? "events" : "trainings");
    return;
  }
  const { error } = await adminClient.from(table).upsert({
    [key]: entityId,
    member_id: memberId,
    attending: nextStatus,
    note: nextNote,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await bumpVersion(entityType === "event" ? "events" : "trainings");
}

async function trainingById(id: string) {
  const column = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? "id" : "legacy_id";
  const { data, error } = await adminClient.from("trainings").select("id,training_date,description").eq(column, id).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error(`Training session not found: ${id}`), { status: 404 });
  const attendance = await attendanceFor("training", [data.id]);
  const record = attendance.get(data.id) || { attendees: [], rejections: [], notes: {} };
  return {
    id: data.id,
    date: data.training_date,
    description: data.description,
    attendees: record.attendees,
    rejections: record.rejections,
    notes: record.notes,
  };
}

async function eventById(id: string) {
  const column = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? "id" : "legacy_id";
  let { data, error } = await adminClient.from("events").select("id,name,event_date,event_datetime,meeting_place,place_url,attendance_list_id,confirmed,visible").eq(column, id).maybeSingle();
  if (error) throw error;
  if (!data) {
    ({ data, error } = await adminClient.from("events").select("id,name,event_date,event_datetime,meeting_place,place_url,attendance_list_id,confirmed,visible").eq("name", id).maybeSingle());
    if (error) throw error;
  }
  if (!data) throw Object.assign(new Error("Event not found"), { status: 404 });
  const attendance = await attendanceFor("event", [data.id]);
  const record = attendance.get(data.id) || { attendees: [], rejections: [], notes: {} };
  const { data: diagrams, error: diagramError } = await adminClient.from("event_diagrams")
    .select("diagram_data").eq("event_id", data.id).order("position");
  if (diagramError) throw diagramError;
  return {
    id: data.id, name: data.name, date: data.event_date || "", datetime: data.event_datetime || "",
    meetingPlace: data.meeting_place || "", placeUrl: data.place_url || "",
    attendanceListId: data.attendance_list_id || "", confirmed: data.confirmed, visible: data.visible,
    diagrams: (diagrams || []).map((row) => row.diagram_data), ...record,
  };
}

function eventListItem(row: JsonRecord, attendance: JsonRecord) {
  return {
    id: row.id,
    name: row.name,
    date: row.event_date || "",
    meetingPlace: row.meeting_place || "",
    placeUrl: row.place_url || "",
    confirmed: Boolean(row.confirmed),
    visible: Boolean(row.visible),
    attendees: attendance.attendees.length ? attendance.attendees : null,
    rejections: attendance.rejections.length ? attendance.rejections : null,
    notes: Object.keys(attendance.notes).length ? attendance.notes : null,
  };
}

async function memberProfile(user: JsonRecord, includeResolvedRelations: boolean) {
  const members = await loadMembers();
  const byId = new Map<string, JsonRecord>();
  for (const member of members) byId.set(String(member.id), member);
  const relatedMembers = user.relations.map((id: string) => byId.get(id)).filter(Boolean).map((member: JsonRecord) => ({
    id: member.id,
    alias: member.alias || "",
    name: member.name,
    type: member.type || "",
    avatar: avatar(member.name, member.roles || []),
  }));
  const member = user.member;
  return {
    email: user.email,
    displayName: member.name || user.email.split("@")[0],
    alias: member.alias,
    avatar: avatar(member.name, user.roles),
    memberType: member.type || "",
    roles: user.roles,
    relations: includeResolvedRelations
      ? user.relations.map((id: string) => byId.get(id)?.name).filter(Boolean)
      : user.relations,
    relatedMembers,
  };
}

async function dispatch(request: Request, input: JsonRecord) {
  const { action, method = "GET", body = {}, parameters = {} } = input;
  if (!action || typeof action !== "string") return failure("No action specified");

  if (action === "login") {
    const { data, error } = await publicClient.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error || !data.user || !data.session) return failure("Email or password is incorrect", 400);
    const { data: row, error: memberError } = await adminClient.from("members").select("id,email,alias,name,type,roles,active")
      .ilike("email", body.email).limit(1).maybeSingle();
    if (memberError) throw memberError;
    if (!row || row.active === false) {
      return failure("No active member is linked to this account", 403);
    }
    const user = {
      authUser: data.user,
      member: row,
      email: data.user.email,
      alias: row.alias || row.name,
      roles: row.roles || [],
      relations: await memberRelations(String(row.id)),
      memberId: String(row.id),
    };
    return success({
      user: await memberProfile(user, false),
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    });
  }

  if (action === "sendAccessLink") {
    if (!body.email) return failure("Email is required");
    const { error } = await publicClient.auth.signInWithOtp({
      email: body.email,
      options: { shouldCreateUser: false, emailRedirectTo: Deno.env.get("WEBSITE_URL") },
    });
    if (error) throw error;
    return success({ message: "Access link sent if the account exists" });
  }

  if (action === "register") {
    if (!body.name || !body.email) return failure("Name and email are required");
    const { data: member, error: memberError } = await adminClient.from("members")
      .select("id").ilike("email", body.email).limit(1).maybeSingle();
    if (memberError) throw memberError;
    if (member) return failure("This email is already linked to a member", 409);
    const { error } = await adminClient.from("registration_requests").insert({ name: body.name, email: body.email });
    if (error) throw error;
    return success({ message: "Registration request submitted" });
  }

  const user = await currentUser(request);
  const adminActions = new Set([
    "members", "saveMember", "saveAllMembers", "saveEvent", "setEventVisibility",
    "saveTraining", "adminSetMemberAttendance", "calculateEventDancePositions",
    "checkFormAttendance", "sendCommunication", "changePassword",
  ]);
  if (adminActions.has(action)) await requireAdmin(user);

  switch (action) {
    case "user":
      return success({ user: await memberProfile(user, true) });
    case "logout":
      return success({ message: "Session closed" });
    case "dataVersions": {
      const { data, error } = await adminClient.from("data_versions").select("name,version");
      if (error) throw error;
      return success(Object.fromEntries((data || []).map((row) => [row.name, row.version])));
    }
    case "members":
      return success((await loadMembers()).map((member: JsonRecord, _, all: JsonRecord[]) => ({
        ...member,
        relatedMembers: (member.relations || []).map((id: string) => all.find((other) => String(other.id) === String(id)))
          .filter(Boolean).map((related: JsonRecord) => ({
            id: related.id, alias: related.alias || "", name: related.name, type: related.type || "",
            avatar: avatar(related.name, related.roles || []),
          })),
      })));
    case "events": {
      const { data, error } = await adminClient.from("events").select("id,name,event_date,meeting_place,place_url,confirmed,visible").order("event_date", { ascending: false });
      if (error) throw error;
      const attendance = await attendanceFor("event", (data || []).map((row) => row.id));
      return success((data || []).map((row) => eventListItem(row, attendance.get(row.id) || { attendees: [], rejections: [], notes: {} })));
    }
    case "event":
      return success(await eventById(String(parameters.eventId || "")));
    case "nextEvent": {
      const { data, error } = await adminClient.from("events").select("event_date")
        .gt("event_date", new Date().toISOString()).order("event_date").limit(1);
      if (error) throw error;
      return success({ eventData: data?.[0]?.event_date || null });
    }
    case "trainings": {
      const { data, error } = await adminClient.from("trainings").select("id,training_date,description").order("training_date");
      if (error) throw error;
      const attendance = await attendanceFor("training", (data || []).map((row) => row.id));
      return success((data || []).map((row) => ({
        id: row.id,
        date: row.training_date,
        description: row.description,
        ...(attendance.get(row.id) || { attendees: [], rejections: [], notes: {} }),
      })));
    }
    case "training":
      return success(await trainingById(String(parameters.trainingId || "")));
    case "nextTraining": {
      const { data, error } = await adminClient.from("trainings").select("training_date").gt("training_date", new Date().toISOString()).order("training_date").limit(1);
      if (error) throw error;
      return success({ trainingData: data?.[0]?.training_date || null });
    }
    case "saveMember": {
      const member = body.member;
      if (!member) return failure("Invalid member data");
      const members = await loadMembers();
      const isNew = !member.id || member.isNew;
      const existing = members.find((item: JsonRecord) => String(item.id) === String(member.id));
      if (!isNew && !existing) return failure("Member not found", 404);
      const id = isNew
        ? String(Math.max(0, ...members.map((item: JsonRecord) => Number(item.id) || 0)) + 1)
        : String(member.id);
      const isKid = member.type === "KID";
      const alias = String(member.alias || member.name || existing?.alias || "").trim();
      const next = {
        id,
        alias,
        name: String(member.fullName || existing?.name || alias).trim(),
        email: isKid ? "" : member.email || "",
        type: member.type || "ADULT",
        roles: isKid ? [] : member.roles || [],
        relations: isKid ? [] : member.relations || [],
        active: isNew || member.active !== false,
      };
      const { error } = await adminClient.rpc("save_member", { p_member: next });
      if (error) throw error;
      await bumpVersion("members");
      return success({ member: next });
    }
    case "saveAllMembers": {
      if (!Array.isArray(body.members)) return failure("Invalid members data");
      const results = [];
      for (const member of body.members) {
        const result = await dispatch(request, { action: "saveMember", method: "PUT", body: { member }, parameters });
        if (!result.success) return result;
        results.push(result.result.member);
      }
      return success({ members: results });
    }
    case "saveEvent": {
      const event = body.event;
      if (!event?.name) return failure("Event name is required");
      const current = event.id ? await eventById(String(event.id)) : null;
      const id = current?.id || crypto.randomUUID();
      const { error } = await adminClient.rpc("save_event", { p_id: id, p_event: event });
      if (error) throw error;
      await bumpVersion("events");
      if (!current) {
        const datetime = event.datetime || event.date || "";
        const date = datetime ? String(datetime).replace("T", " ").substring(0, 16) : "";
        try {
          await notifyAllDevices("Nou acte programat", `${event.name}${date ? ` · ${date}` : ""}`);
        } catch (notificationError) {
          console.error("Could not send event notification:", (notificationError as Error).message);
        }
      }
      return success({
        message: current ? "Actuació actualitzada correctament" : "Actuació creada correctament",
        sheetName: id,
      });
    }
    case "setEventVisibility": {
      const { data, error } = await adminClient.from("events").select("id").eq("name", body.eventName).maybeSingle();
      if (error) throw error;
      if (!data) return failure("Event not found", 404);
      const { error: updateError } = await adminClient.from("events").update({
        visible: Boolean(body.visible),
        updated_at: new Date().toISOString(),
      }).eq("id", data.id);
      if (updateError) throw updateError;
      await bumpVersion("events");
      return success({ message: body.visible ? "Actuació visible correctament" : "Actuació ocultada correctament" });
    }
    case "saveTraining": {
      const training = body.training;
      const date = String(training?.newDate || training?.date || "");
      if (!date) return failure("Training date is required");
      const allowedFields = new Set(["id", "date", "newDate", "description", "attendees", "rejections", "notes"]);
      if (Object.keys(training).some((key) => !allowedFields.has(key))) return failure("Unsupported training field");
      if (training.description != null && typeof training.description !== "string") return failure("Invalid training description");
      const existingTraining = training.id ? await trainingById(String(training.id)) : null;
      const id = existingTraining?.id || crypto.randomUUID();
      const { error } = await adminClient.from("trainings").upsert({
        id,
        training_date: date,
        description: training.description ?? existingTraining?.description ?? "",
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      if (Array.isArray(training.attendees)) {
        const previous = existingTraining?.attendees || [];
        for (const alias of new Set([...previous, ...training.attendees])) {
          await setAttendance("training", id, alias, training.attendees.includes(alias) ? true : null);
        }
      }
      await bumpVersion("trainings");
      return success({ message: "Assaig actualitzat correctament", trainingId: id });
    }
    case "confirmTrainingAttendance":
    case "cancelTrainingAttendance": {
      const id = (await trainingById(String(body.trainingId || ""))).id;
      const attending = action === "confirmTrainingAttendance";
      await setAttendance("training", id, user.alias, attending);
      return success({
        trainingId: id,
        status: attending ? "confirmed" : "not-attending",
        value: attending ? "SI" : "NO",
        message: attending ? "Assistència confirmada" : "Has marcat que no assistiràs",
      });
    }
    case "confirmRelatedMemberAttendance":
    case "cancelRelatedMemberAttendance": {
      await relatedMember(user, body.memberId, body.memberAlias);
      const id = (await trainingById(String(body.trainingId || ""))).id;
      const attending = action === "confirmRelatedMemberAttendance";
      await setAttendance("training", id, body.memberAlias, attending);
      return success({
        trainingId: id,
        memberId: body.memberId,
        memberAlias: body.memberAlias,
        status: attending ? "confirmed" : "not-attending",
        value: attending ? "SI" : "NO",
        message: attending ? "Assistència confirmada" : "Marcat que no assistirà",
      });
    }
    case "adminSetMemberAttendance": {
      const id = (await trainingById(String(body.trainingId || ""))).id;
      await setAttendance("training", id, String(body.memberAlias), Boolean(body.attending));
      return success({
        trainingId: id,
        memberAlias: body.memberAlias,
        attending: Boolean(body.attending),
        message: body.attending ? "Assistència confirmada" : "Assistència rebutjada",
      });
    }
    case "confirmEventMemberAttendance": {
      const target = String(body.memberAlias || "");
      if (target.toLowerCase() !== String(user.alias).toLowerCase() && !user.roles.includes("ADMIN")) {
        const { data: targetRow, error } = await adminClient.from("members").select("id")
          .ilike("alias", target).maybeSingle();
        if (error) throw error;
        if (!targetRow || !user.relations.includes(String(targetRow.id))) {
          return failure("You cannot change this member's event attendance", 403);
        }
      }
      const event = await eventById(String(body.eventId || ""));
      await setAttendance("event", event.id, target, Boolean(body.attending));
      return success({
        eventId: body.eventId,
        memberAlias: target,
        attending: Boolean(body.attending),
        message: body.attending ? "Assistència confirmada" : "Assistència rebutjada",
      });
    }
    case "saveTrainingNote":
    case "saveRelatedMemberTrainingNote": {
      const alias = action === "saveTrainingNote" ? user.alias : String(body.memberAlias || "");
      if (action === "saveRelatedMemberTrainingNote") await relatedMember(user, body.memberId, alias);
      const id = (await trainingById(String(body.trainingId || ""))).id;
      await setAttendance("training", id, alias, undefined, body.note || null);
      return success({
        trainingId: id,
        memberAlias: alias,
        note: body.note || "",
        message: body.note ? "Nota desada" : "Nota esborrada",
      });
    }
    case "memberPositions": {
      const target = String(parameters.memberAlias || "");
      if (target.toLowerCase() !== String(user.alias).toLowerCase() && !user.roles.includes("ADMIN")) {
        const members = await loadMembers();
        const member = members.find((item: JsonRecord) => String(item.alias).toLowerCase() === target.toLowerCase());
        if (!member || !user.relations.includes(String(member.id))) return failure("You cannot view these positions", 403);
      }
      const memberId = await memberIdForAlias(target);
      const dances: JsonRecord[] = [];
      const positions: JsonRecord[] = [];
      for (let offset = 0;; offset += 1000) {
        const { data, error } = await adminClient.from("member_dances").select("dance_id,dances!inner(name)")
          .eq("member_id", memberId).order("dance_id").range(offset, offset + 999);
        if (error) throw error;
        dances.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      for (let offset = 0;; offset += 1000) {
        const { data, error } = await adminClient.from("member_positions")
          .select("dance_id,position_order,status").eq("member_id", memberId)
          .order("dance_id").order("position_order").range(offset, offset + 999);
        if (error) throw error;
        positions.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      const byDance = new Map(dances.map((row) => [row.dance_id, row.dances.name]));
      const result: JsonRecord = Object.fromEntries(dances.map((row) => [row.dances.name, {}]));
      for (const position of positions) {
        const name = byDance.get(position.dance_id);
        if (!name) throw new Error("Member position refers to an unknown dance");
        const values: Record<string, string> = { known: "SI", learning: "EN PROGRES", not_known: "NO" };
        if (position.status !== null && !(position.status in values)) throw new Error("Unknown position status");
        result[name][String(position.position_order)] = position.status === null ? "" : values[position.status];
      }
      return success(result);
    }
    case "updateMemberPosition": {
      const target = String(body.memberAlias || "");
      if (!target || !body.danceName || body.positionOrder === undefined || body.positionOrder === null || !body.value) {
        return failure("Member, dance, position, and value are required");
      }
      const positionOrder = String(body.positionOrder);
      if (!/^(0|[1-9][0-9]{0,9})$/.test(positionOrder) || Number(positionOrder) > 2147483647) {
        return failure("Invalid position order");
      }
      const positionStatuses: Record<string, string> = { SI: "known", "EN PROGRES": "learning", NO: "not_known" };
      const positionStatus = positionStatuses[String(body.value).trim().toUpperCase()];
      if (!positionStatus) return failure("Invalid position status");
      if (target.toLowerCase() !== String(user.alias).toLowerCase() && !user.roles.includes("ADMIN")) {
        const members = await loadMembers();
        const member = members.find((item: JsonRecord) => String(item.alias).toLowerCase() === target.toLowerCase());
        if (!member || !user.relations.includes(String(member.id))) return failure("You cannot update these positions", 403);
      }
      const memberId = await memberIdForAlias(target);
      const { error: saveError } = await adminClient.rpc("save_member_position", {
        p_member_id: memberId, p_dance_name: body.danceName,
        p_position_order: Number(positionOrder), p_value: positionStatus,
      });
      if (saveError) throw saveError;
      return success({ success: true });
    }
    case "registerPushToken": {
      const pushToken = body.pushToken;
      if (!pushToken) return failure("Push token is required");
      const { error } = method === "DELETE"
        ? await adminClient.from("push_tokens").delete().eq("token", pushToken).eq("member_id", user.memberId)
        : await adminClient.from("push_tokens").upsert({ token: pushToken, member_id: user.memberId });
      if (error) throw error;
      return success({ status: method === "DELETE" ? "removed" : "saved" });
    }
    case "sendCommunication": {
      if (!body.title || !body.message) return failure("Title and message are required");
      const { data: tokens, error } = await adminClient.from("push_tokens").select("token,member_id");
      if (error) throw error;
      const recipients = new Set((body.recipientUserIds || []).map(String));
      const selected = [...new Set((tokens || [])
        .filter((row) => !recipients.size || recipients.has(String(row.member_id)))
        .map((row) => row.token))];
      if (!selected.length) return failure("No registered device can receive notifications", 404);
      const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
      if (!projectId) throw new Error("FIREBASE_PROJECT_ID is not configured");
      const accessToken = await firebaseAccessToken();
      let sent = 0;
      let failed = 0;
      for (const token of selected) {
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              data: { title: body.title, body: body.message },
              webpush: { fcm_options: { link: Deno.env.get("WEBSITE_URL") || "/" } },
            },
          }),
        });
        if (response.ok) {
          sent++;
        } else {
          failed++;
          const errorBody = await response.text();
          if (response.status === 404 || response.status === 410 || errorBody.includes("UNREGISTERED")) {
            const { error: deleteError } = await adminClient.from("push_tokens").delete().eq("token", token);
            if (deleteError) console.error("Could not remove invalid push token:", deleteError.message);
          }
        }
      }
      return success({ sent, failed, total: sent + failed });
    }
    case "changePassword": {
      if (!body.email || !body.newPassword || body.newPassword.length < 8) return failure("A valid email and password of at least 8 characters are required");
      let targetUser;
      for (let page = 1; !targetUser; page++) {
        const { data: authUsers, error: findError } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
        if (findError) throw findError;
        targetUser = authUsers.users.find((item) => item.email?.toLowerCase() === body.email.toLowerCase());
        if (!targetUser && authUsers.users.length < 1000) break;
      }
      if (!targetUser) return failure("No Supabase account exists for this email", 404);
      const { error } = await adminClient.auth.admin.updateUserById(targetUser.id, { password: body.newPassword });
      if (error) throw error;
      return success({ message: "Password changed" });
    }
    case "calculateEventDancePositions": {
      const danceName = String(parameters.danceName || "");
      if (!danceName) return failure("Dance name is required");
      const { data, error } = await adminClient.from("events").select("id").lt("event_date", new Date().toISOString());
      if (error) throw error;
      const ids = (data || []).map((row) => row.id);
      const { data: diagrams, error: diagramError } = ids.length
        ? await adminClient.from("event_diagrams").select("diagram_data").in("event_id", ids)
        : { data: [], error: null };
      if (diagramError) throw diagramError;
      const counts: JsonRecord = {};
      for (const row of diagrams || []) {
        const diagram = row.diagram_data;
        if (diagram.danceName !== danceName) continue;
        for (const position of diagram.positions || []) {
          const order = String(position.order);
          counts[order] ||= { tag: position.tag || position.label || `Pos ${order}`, members: {} };
          for (const group of diagram.groups || []) {
            const name = group[position.order - 1];
            if (name) counts[order].members[name] = (counts[order].members[name] || 0) + 1;
          }
        }
      }
      const attendees = JSON.parse(parameters.attendees || "[]");
      const result = Object.fromEntries(Object.entries(counts).map(([order, value]: [string, any]) => [
        order,
        {
          tag: value.tag,
          members: Object.entries(value.members).map(([name, count]) => ({
            name, count, ...(attendees.length ? { attending: attendees.includes(name) } : {}),
          })).sort((a: any, b: any) => b.count - a.count),
        },
      ]));
      return success(result);
    }
    case "audio": {
      const audioId = String(parameters.audioId || "");
      if (!audioId || !/^[A-Za-z0-9_-]+$/.test(audioId)) return failure("Invalid audio ID");
      const { data, error } = await adminClient.storage.from("dance-audio").download(`${audioId}.mp3`);
      if (error) return failure("Audio file is missing from Supabase Storage", 404);
      const bytes = new Uint8Array(await data.arrayBuffer());
      return success({ audioData: `data:audio/mpeg;base64,${base64(bytes)}` });
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
