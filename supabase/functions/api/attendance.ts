import { adminClient, bumpVersion, success, type JsonRecord } from "./infrastructure.ts";
import { memberIdForAlias, relatedMember } from "./members.ts";

export async function attendanceFor(entityType: string, ids: string[]) {
  if (!ids.length) return new Map();
  const table = entityType === "event" ? "event_attendance" : "training_attendance";
  const key = entityType === "event" ? "event_id" : "training_id";
  const { data, error } = await adminClient.from(table)
    .select(`${key},member_id,attending,note,members!inner(alias)`).in(key, ids);
  if (error) throw error;
  const grouped = new Map<string, JsonRecord>();
  const rows: JsonRecord[] = data || [];
  for (const row of rows) {
    const item = grouped.get(row[key]) || { attendees: [], rejections: [], notes: {} };
    const alias = row.members.alias;
    if (row.attending === true) item.attendees.push(alias);
    if (row.attending === false) item.rejections.push(alias);
    if (row.note) item.notes[alias] = row.note;
    grouped.set(row[key], item);
  }
  return grouped;
}

export async function setAttendance(entityType: string, entityId: string, alias: string, attending?: boolean | null, note?: string | null) {
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

type AttendanceDependencies = {
  eventById: (id: string) => Promise<JsonRecord>;
  setAttendance: (entityType: string, entityId: string, alias: string, attending?: boolean | null, note?: string | null) => Promise<void>;
  trainingById: (id: string) => Promise<JsonRecord>;
};

export async function handleAttendanceAction(action: string, body: JsonRecord, user: JsonRecord, dependencies: AttendanceDependencies) {
  if (action === "confirmTrainingAttendance" || action === "cancelTrainingAttendance") {
    const id = (await dependencies.trainingById(String(body.trainingId || ""))).id;
    const attending = action === "confirmTrainingAttendance";
    await dependencies.setAttendance("training", id, user.alias, attending);
    return success({
      trainingId: id,
      status: attending ? "confirmed" : "not-attending",
      value: attending ? "SI" : "NO",
      message: attending ? "Assistència confirmada" : "Has marcat que no assistiràs",
    });
  }
  if (action === "confirmRelatedMemberAttendance" || action === "cancelRelatedMemberAttendance") {
    await relatedMember(user, body.memberId, body.memberAlias);
    const id = (await dependencies.trainingById(String(body.trainingId || ""))).id;
    const attending = action === "confirmRelatedMemberAttendance";
    await dependencies.setAttendance("training", id, body.memberAlias, attending);
    return success({
      trainingId: id,
      memberId: body.memberId,
      memberAlias: body.memberAlias,
      status: attending ? "confirmed" : "not-attending",
      value: attending ? "SI" : "NO",
      message: attending ? "Assistència confirmada" : "Marcat que no assistirà",
    });
  }
  if (action === "adminSetMemberAttendance") {
    const id = (await dependencies.trainingById(String(body.trainingId || ""))).id;
    await dependencies.setAttendance("training", id, String(body.memberAlias), Boolean(body.attending));
    return success({
      trainingId: id,
      memberAlias: body.memberAlias,
      attending: Boolean(body.attending),
      message: body.attending ? "Assistència confirmada" : "Assistència rebutjada",
    });
  }
  if (action === "confirmEventMemberAttendance") {
    const target = String(body.memberAlias || "");
    if (target.toLowerCase() !== String(user.alias).toLowerCase() && !user.roles.includes("ADMIN")) {
      const { data: targetRow, error } = await adminClient.from("members").select("id")
        .ilike("alias", target).maybeSingle();
      if (error) throw error;
      if (!targetRow || !user.relations.includes(String(targetRow.id))) {
        return { success: false, status: 403, error: "You cannot change this member's event attendance" };
      }
    }
    const event = await dependencies.eventById(String(body.eventId || ""));
    await dependencies.setAttendance("event", event.id, target, Boolean(body.attending));
    return success({
      eventId: body.eventId,
      memberAlias: target,
      attending: Boolean(body.attending),
      message: body.attending ? "Assistència confirmada" : "Assistència rebutjada",
    });
  }
  if (action === "saveTrainingNote" || action === "saveRelatedMemberTrainingNote") {
    const alias = action === "saveTrainingNote" ? user.alias : String(body.memberAlias || "");
    if (action === "saveRelatedMemberTrainingNote") await relatedMember(user, body.memberId, alias);
    const id = (await dependencies.trainingById(String(body.trainingId || ""))).id;
    await dependencies.setAttendance("training", id, alias, undefined, body.note || null);
    return success({
      trainingId: id,
      memberAlias: alias,
      note: body.note || "",
      message: body.note ? "Nota desada" : "Nota esborrada",
    });
  }
  return null;
}