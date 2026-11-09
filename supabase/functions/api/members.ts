import { adminClient, bumpVersion, failure, success, type JsonRecord } from "./infrastructure.ts";

export function avatar(name: string, roles: string[] = []) {
  const background = roles.includes("ADMIN") ? "000000" : "667eea";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}&background=${background}&color=fff&size=128`;
}

export async function loadMembers(): Promise<JsonRecord[]> {
  const { data, error } = await adminClient.from("members").select("id,email,alias,name,type,roles,active").range(0, 9999);
  if (error) throw error;
  const { data: relations, error: relationError } = await adminClient.from("member_relations")
    .select("member_id,related_member_id,position").order("position").range(0, 9999);
  if (relationError) throw relationError;
  return (data || []).map((row: JsonRecord) => ({
    ...row,
    email: row.email || "",
    relations: (relations || []).filter((relation: JsonRecord) => relation.member_id === row.id)
      .map((relation: JsonRecord) => relation.related_member_id),
  }));
}

export async function memberRelations(memberId: string) {
  const { data, error } = await adminClient.from("member_relations")
    .select("related_member_id").eq("member_id", memberId).order("position");
  if (error) throw error;
  return (data || []).map((row: JsonRecord) => String(row.related_member_id));
}

export async function currentUser(request: Request) {
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
  return {
    authUser: authData.user,
    member: row,
    email: authData.user.email,
    alias: row.alias || row.name,
    roles: row.roles || [],
    relations: await memberRelations(String(row.id)),
    memberId: String(row.id),
  };
}

export async function requireAdmin(user: JsonRecord) {
  if (!user.roles.includes("ADMIN")) {
    throw Object.assign(new Error("Administrator permissions are required"), { status: 403 });
  }
}

export async function relatedMember(user: JsonRecord, memberId: string, alias: string) {
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

export async function memberIdForAlias(alias: string) {
  const { data, error } = await adminClient.from("members")
    .select("id").ilike("alias", alias).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error(`Member not found: ${alias}`), { status: 404 });
  return String(data.id);
}

export async function memberProfile(user: JsonRecord, includeResolvedRelations: boolean) {
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

async function saveMember(member: JsonRecord): Promise<JsonRecord> {
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

export async function handleMemberAction(action: string, body: JsonRecord, user: JsonRecord) {
  if (action === "user") return success({ user: await memberProfile(user, true) });
  if (action === "members") {
    const members = await loadMembers();
    return success(members.map((member: JsonRecord) => ({
      ...member,
      relatedMembers: (member.relations || []).map((id: string) => members.find((other: JsonRecord) => String(other.id) === String(id)))
        .filter(Boolean).map((related: JsonRecord) => ({
          id: related.id, alias: related.alias || "", name: related.name, type: related.type || "",
          avatar: avatar(related.name, related.roles || []),
        })),
    })));
  }
  if (action === "saveMember") return saveMember(body.member);
  if (action === "saveAllMembers") {
    if (!Array.isArray(body.members)) return failure("Invalid members data");
    const results = [];
    for (const member of body.members) {
      const result = await saveMember(member);
      if (!result.success) return result;
      results.push(result.result.member);
    }
    return success({ members: results });
  }
  return null;
}