import { eventById } from "../events.ts";
import { failure, success, type JsonRecord } from "../infrastructure.ts";
import { loadMembers } from "../members.ts";
import { serviceAccountAccessToken } from "./google.ts";

export async function checkFormAttendance(spreadsheetId: string, eventId: string | undefined) {
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