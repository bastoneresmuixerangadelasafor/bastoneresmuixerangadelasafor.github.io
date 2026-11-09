import { adminClient, failure, success, type JsonRecord } from "./infrastructure.ts";
import { firebaseAccessToken } from "./integrations/google.ts";

export async function handleNotificationAction(action: string, method: string, body: JsonRecord, user: JsonRecord) {
  if (action === "registerPushToken") {
    const pushToken = body.pushToken;
    if (!pushToken) return failure("Push token is required");
    const { error } = method === "DELETE"
      ? await adminClient.from("push_tokens").delete().eq("token", pushToken).eq("member_id", user.memberId)
      : await adminClient.from("push_tokens").upsert({ token: pushToken, member_id: user.memberId });
    if (error) throw error;
    return success({ status: method === "DELETE" ? "removed" : "saved" });
  }
  if (action === "sendCommunication") {
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
  return null;
}