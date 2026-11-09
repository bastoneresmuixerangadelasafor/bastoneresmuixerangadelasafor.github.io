import { adminClient, failure, success } from "./infrastructure.ts";

export async function handleMediaAction(action: string, parameters: Record<string, any>) {
  if (action !== "audio") return null;
  const audioId = String(parameters.audioId || "");
  if (!audioId || !/^[A-Za-z0-9_-]+$/.test(audioId)) return failure("Invalid audio ID");
  const { data, error } = await adminClient.storage.from("dance-audio").download(`${audioId}.mp3`);
  if (error) return failure("Audio file is missing from Supabase Storage", 404);
  const bytes = new Uint8Array(await data.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return success({ audioData: `data:audio/mpeg;base64,${btoa(binary)}` });
}