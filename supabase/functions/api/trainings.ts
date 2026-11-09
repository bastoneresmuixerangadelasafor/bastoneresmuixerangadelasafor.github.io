import { attendanceFor } from "./attendance.ts";
import { adminClient, bumpVersion, failure, success, type JsonRecord } from "./infrastructure.ts";

export async function trainingById(id: string) {
  const column = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? "id" : "legacy_id";
  const { data, error } = await adminClient.from("trainings").select("id,training_date,description").eq(column, id).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error(`Training session not found: ${id}`), { status: 404 });
  const attendance = await attendanceFor("training", [data.id]);
  const record = attendance.get(data.id) || { attendees: [], rejections: [], notes: {} };
  return {
    id: data.id,
    date: data.training_date,
    description: data.description,
    attendees: record.attendees,
    rejections: record.rejections,
    notes: record.notes,
  };
}

type TrainingDependencies = {
  attendanceFor: (entityType: string, ids: string[]) => Promise<Map<string, JsonRecord>>;
  setAttendance: (entityType: string, entityId: string, alias: string, attending?: boolean | null, note?: string | null) => Promise<void>;
};

export async function handleTrainingAction(action: string, body: JsonRecord, parameters: JsonRecord, dependencies: TrainingDependencies) {
  if (action === "trainings") {
    const { data, error } = await adminClient.from("trainings").select("id,training_date,description").order("training_date");
    if (error) throw error;
    const attendance = await dependencies.attendanceFor("training", (data || []).map((row) => row.id));
    return success((data || []).map((row) => ({
      id: row.id,
      date: row.training_date,
      description: row.description,
      ...(attendance.get(row.id) || { attendees: [], rejections: [], notes: {} }),
    })));
  }
  if (action === "training") return success(await trainingById(String(parameters.trainingId || "")));
  if (action === "nextTraining") {
    const { data, error } = await adminClient.from("trainings").select("training_date")
      .gt("training_date", new Date().toISOString()).order("training_date").limit(1);
    if (error) throw error;
    return success({ trainingData: data?.[0]?.training_date || null });
  }
  if (action === "saveTraining") {
    const training = body.training;
    const date = String(training?.newDate || training?.date || "");
    if (!date) return failure("Training date is required");
    const allowedFields = new Set(["id", "date", "newDate", "description", "attendees", "rejections", "notes"]);
    if (Object.keys(training).some((key) => !allowedFields.has(key))) return failure("Unsupported training field");
    if (training.description != null && typeof training.description !== "string") return failure("Invalid training description");
    const existingTraining = training.id ? await trainingById(String(training.id)) : null;
    const id = existingTraining?.id || crypto.randomUUID();
    const { error } = await adminClient.from("trainings").upsert({
      id,
      training_date: date,
      description: training.description ?? existingTraining?.description ?? "",
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    if (Array.isArray(training.attendees)) {
      const previous = existingTraining?.attendees || [];
      for (const alias of new Set([...previous, ...training.attendees])) {
        await dependencies.setAttendance("training", id, alias, training.attendees.includes(alias) ? true : null);
      }
    }
    await bumpVersion("trainings");
    return success({ message: "Assaig actualitzat correctament", trainingId: id });
  }
  return null;
}