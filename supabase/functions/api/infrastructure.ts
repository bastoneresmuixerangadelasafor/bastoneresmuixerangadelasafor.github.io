import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const publicClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type JsonRecord = Record<string, any>;

export function success(result: unknown) {
  return { success: true, status: 200, result };
}

export function failure(error: string, status = 400) {
  return { success: false, status, error };
}

export async function bumpVersion(name: string) {
  const { error } = await adminClient.from("data_versions").upsert({ name, version: Date.now() });
  if (error) throw error;
}