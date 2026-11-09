import { adminClient, failure, success, type JsonRecord } from "./infrastructure.ts";

type PositionDependencies = {
  loadMembers: () => Promise<JsonRecord[]>;
  memberIdForAlias: (alias: string) => Promise<string>;
};

export async function handlePositionAction(action: string, body: JsonRecord, parameters: JsonRecord, user: JsonRecord, dependencies: PositionDependencies) {
  if (action === "memberPositions") {
    const target = String(parameters.memberAlias || "");
    if (target.toLowerCase() !== String(user.alias).toLowerCase() && !user.roles.includes("ADMIN")) {
      const members = await dependencies.loadMembers();
      const member = members.find((item: JsonRecord) => String(item.alias).toLowerCase() === target.toLowerCase());
      if (!member || !user.relations.includes(String(member.id))) return failure("You cannot view these positions", 403);
    }
    const memberId = await dependencies.memberIdForAlias(target);
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
  if (action === "updateMemberPosition") {
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
      const members = await dependencies.loadMembers();
      const member = members.find((item: JsonRecord) => String(item.alias).toLowerCase() === target.toLowerCase());
      if (!member || !user.relations.includes(String(member.id))) return failure("You cannot update these positions", 403);
    }
    const memberId = await dependencies.memberIdForAlias(target);
    const { error: saveError } = await adminClient.rpc("save_member_position", {
      p_member_id: memberId, p_dance_name: body.danceName,
      p_position_order: Number(positionOrder), p_value: positionStatus,
    });
    if (saveError) throw saveError;
    return success({ success: true });
  }
  return null;
}