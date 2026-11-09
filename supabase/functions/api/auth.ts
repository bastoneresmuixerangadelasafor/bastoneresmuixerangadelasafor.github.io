import { adminClient, failure, publicClient, success, type JsonRecord } from "./infrastructure.ts";
import { memberProfile, memberRelations } from "./members.ts";

export async function handleAuthAction(action: string, body: JsonRecord) {
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

  return null;
}

export async function handlePasswordChange(body: JsonRecord) {
  if (!body.email || !body.newPassword || body.newPassword.length < 8) {
    return failure("A valid email and password of at least 8 characters are required");
  }
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