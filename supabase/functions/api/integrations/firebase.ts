import { adminClient } from "../infrastructure.ts";
import { firebaseAccessToken } from "./google.ts";

export async function notifyAllDevices(title: string, message: string) {
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