import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const required = ["LEGACY_API_URL", "LEGACY_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} must be set in the environment`);
}

const legacyUrl = process.env.LEGACY_API_URL;
const supabaseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  let value;
  try {
    value = body ? JSON.parse(body) : null;
  } catch {
    throw new Error(`Expected JSON from ${new URL(url).origin}; received HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(value?.error || value?.message || `Request failed with HTTP ${response.status}`);
  return value;
}

const exportUrl = new URL(legacyUrl);
exportUrl.search = new URLSearchParams({ action: "migrationExport", token: process.env.LEGACY_TOKEN });
const legacyResponse = await getJson(exportUrl);
if (!legacyResponse?.success || !legacyResponse.result) {
  throw new Error(legacyResponse?.error || "Legacy migration export failed");
}
const payload = legacyResponse.result;

const skipAudio = process.argv.includes("--skip-audio");
const dancesSource = skipAudio
  ? null
  : await fs.readFile(fileURLToPath(new URL("../docs/scripts/dances.js", import.meta.url)), "utf8");
const dances = dancesSource === null
  ? []
  : JSON.parse(dancesSource.slice(dancesSource.indexOf("=") + 1).trim().replace(/;$/, ""));
const audioIds = [...new Set(dances.flatMap((dance) => (dance.audios || []).map((audio) => audio.fileId)).filter(Boolean))];
const reuseExistingAudio = process.argv.includes("--reuse-existing-audio");

if (skipAudio) {
  console.warn("Skipping audio migration; existing Storage objects are unchanged and missing audio may be unavailable.");
}

for (const audioId of audioIds) {
  const audioUrl = new URL(legacyUrl);
  audioUrl.search = new URLSearchParams({ action: "audio", audioId, token: process.env.LEGACY_TOKEN });
  const audioResponse = await getJson(audioUrl);
  const audioData = audioResponse?.result?.audioData;
  const match = typeof audioData === "string" && audioData.match(/^data:audio\/[^;]+;base64,(.+)$/);
  if (!audioResponse?.success || !match) {
    const titles = dances.flatMap((dance) => (dance.audios || [])
      .filter((audio) => audio.fileId === audioId).map((audio) => audio.title)).filter(Boolean);
    const reason = !audioResponse?.success
      ? String(audioResponse?.error || "Legacy API returned an unsuccessful response")
      : "Legacy API returned invalid or empty audio data";
    const label = titles.length ? ` (${titles.join(", ")})` : "";
    if (reuseExistingAudio) {
      const objectUrl = `${supabaseUrl}/storage/v1/object/authenticated/dance-audio/${encodeURIComponent(audioId)}.mp3`;
      const existing = await fetch(objectUrl, { headers });
      if (!existing.ok) {
        throw new Error(`Could not export audio file ${audioId}${label}: ${reason}. Existing Supabase audio could not be read (HTTP ${existing.status}).`);
      }
      const bytes = await existing.arrayBuffer();
      if (bytes.byteLength === 0) {
        throw new Error(`Could not export audio file ${audioId}${label}: ${reason}. Existing Supabase audio is empty.`);
      }
      console.warn(`Reusing existing Supabase audio ${audioId}${label} (${bytes.byteLength} bytes); the Drive export failed: ${reason}. Its contents may not match the current Drive file.`);
      continue;
    }
    throw new Error(`Could not export audio file ${audioId}${label}: ${reason}. Check that the GAS deployment account can access the Drive file. To explicitly reuse an existing Supabase copy, retry with --reuse-existing-audio.`);
  }
  const uploadUrl = `${supabaseUrl}/storage/v1/object/dance-audio/${encodeURIComponent(audioId)}.mp3`;
  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "audio/mpeg",
      "x-upsert": "true",
    },
    body: Buffer.from(match[1], "base64"),
  });
  if (!upload.ok) throw new Error(`Could not import audio file ${audioId}: HTTP ${upload.status}`);
  console.log(`Migrated audio ${audioId}`);
}

const importResult = await getJson(`${supabaseUrl}/rest/v1/rpc/import_legacy_data`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ p_payload: payload }),
});
console.log("Imported database records:", JSON.stringify(importResult));

if (process.argv.includes("--create-auth-users")) {
  const importedMembers = payload.members || [];
  const existingEmails = new Set();
  let page = 1;
  while (true) {
    const result = await getJson(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers });
    for (const user of result.users || []) {
      if (user.email) existingEmails.add(user.email.toLowerCase());
    }
    if ((result.users || []).length < 1000) break;
    page++;
  }

  for (const member of importedMembers) {
    const email = String(member.email || "").trim().toLowerCase();
    if (!email || existingEmails.has(email)) continue;
    await getJson(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        email_confirm: true,
        user_metadata: { member_id: String(member.id), alias: member.alias || "" },
      }),
    });
    existingEmails.add(email);
    console.log(`Created passwordless auth account for ${email}`);
  }
}
