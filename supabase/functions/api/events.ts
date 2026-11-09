import { attendanceFor } from "./attendance.ts";
import { adminClient, bumpVersion, failure, success, type JsonRecord } from "./infrastructure.ts";

export async function eventById(id: string) {
  const column = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? "id" : "legacy_id";
  let { data, error } = await adminClient.from("events").select("id,name,event_date,event_datetime,meeting_place,place_url,attendance_list_id,confirmed,visible").eq(column, id).maybeSingle();
  if (error) throw error;
  if (!data) {
    ({ data, error } = await adminClient.from("events").select("id,name,event_date,event_datetime,meeting_place,place_url,attendance_list_id,confirmed,visible").eq("name", id).maybeSingle());
    if (error) throw error;
  }
  if (!data) throw Object.assign(new Error("Event not found"), { status: 404 });
  const attendance = await attendanceFor("event", [data.id]);
  const record = attendance.get(data.id) || { attendees: [], rejections: [], notes: {} };
  const { data: diagrams, error: diagramError } = await adminClient.from("event_diagrams")
    .select("diagram_data").eq("event_id", data.id).order("position");
  if (diagramError) throw diagramError;
  return {
    id: data.id, name: data.name, date: data.event_date || "", datetime: data.event_datetime || "",
    meetingPlace: data.meeting_place || "", placeUrl: data.place_url || "",
    attendanceListId: data.attendance_list_id || "", confirmed: data.confirmed, visible: data.visible,
    diagrams: (diagrams || []).map((row) => row.diagram_data), ...record,
  };
}

type EventDependencies = {
  attendanceFor: (entityType: string, ids: string[]) => Promise<Map<string, JsonRecord>>;
  notifyAllDevices: (title: string, message: string) => Promise<void>;
};

export async function handleEventAction(action: string, body: JsonRecord, parameters: JsonRecord, dependencies: EventDependencies) {
  if (action === "events") {
    const { data, error } = await adminClient.from("events").select("id,name,event_date,meeting_place,place_url,confirmed,visible").order("event_date", { ascending: false });
    if (error) throw error;
    const attendance = await dependencies.attendanceFor("event", (data || []).map((row) => row.id));
    return success((data || []).map((row) => {
      const record = attendance.get(row.id) || { attendees: [], rejections: [], notes: {} };
      return {
        id: row.id,
        name: row.name,
        date: row.event_date || "",
        meetingPlace: row.meeting_place || "",
        placeUrl: row.place_url || "",
        confirmed: Boolean(row.confirmed),
        visible: Boolean(row.visible),
        attendees: record.attendees.length ? record.attendees : null,
        rejections: record.rejections.length ? record.rejections : null,
        notes: Object.keys(record.notes).length ? record.notes : null,
      };
    }));
  }
  if (action === "event") return success(await eventById(String(parameters.eventId || "")));
  if (action === "nextEvent") {
    const { data, error } = await adminClient.from("events").select("event_date")
      .gt("event_date", new Date().toISOString()).order("event_date").limit(1);
    if (error) throw error;
    return success({ eventData: data?.[0]?.event_date || null });
  }
  if (action === "saveEvent") {
    const event = body.event;
    if (!event?.name) return failure("Event name is required");
    const current = event.id ? await eventById(String(event.id)) : null;
    const id = current?.id || crypto.randomUUID();
    const { error } = await adminClient.rpc("save_event", { p_id: id, p_event: event });
    if (error) throw error;
    await bumpVersion("events");
    if (!current) {
      const datetime = event.datetime || event.date || "";
      const date = datetime ? String(datetime).replace("T", " ").substring(0, 16) : "";
      try {
        await dependencies.notifyAllDevices("Nou acte programat", `${event.name}${date ? ` · ${date}` : ""}`);
      } catch (notificationError) {
        console.error("Could not send event notification:", (notificationError as Error).message);
      }
    }
    return success({
      message: current ? "Actuació actualitzada correctament" : "Actuació creada correctament",
      sheetName: id,
    });
  }
  if (action === "setEventVisibility") {
    const { data, error } = await adminClient.from("events").select("id").eq("name", body.eventName).maybeSingle();
    if (error) throw error;
    if (!data) return failure("Event not found", 404);
    const { error: updateError } = await adminClient.from("events").update({
      visible: Boolean(body.visible),
      updated_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (updateError) throw updateError;
    await bumpVersion("events");
    return success({ message: body.visible ? "Actuació visible correctament" : "Actuació ocultada correctament" });
  }
  if (action === "calculateEventDancePositions") {
    const danceName = String(parameters.danceName || "");
    if (!danceName) return failure("Dance name is required");
    const { data, error } = await adminClient.from("events").select("id").lt("event_date", new Date().toISOString());
    if (error) throw error;
    const ids = (data || []).map((row) => row.id);
    const { data: diagrams, error: diagramError } = ids.length
      ? await adminClient.from("event_diagrams").select("diagram_data").in("event_id", ids)
      : { data: [], error: null };
    if (diagramError) throw diagramError;
    const counts: JsonRecord = {};
    for (const row of diagrams || []) {
      const diagram = row.diagram_data;
      if (diagram.danceName !== danceName) continue;
      for (const position of diagram.positions || []) {
        const order = String(position.order);
        counts[order] ||= { tag: position.tag || position.label || `Pos ${order}`, members: {} };
        for (const group of diagram.groups || []) {
          const name = group[position.order - 1];
          if (name) counts[order].members[name] = (counts[order].members[name] || 0) + 1;
        }
      }
    }
    const attendees = JSON.parse(parameters.attendees || "[]");
    const result = Object.fromEntries(Object.entries(counts).map(([order, value]: [string, any]) => [
      order,
      {
        tag: value.tag,
        members: Object.entries(value.members).map(([name, count]) => ({
          name, count, ...(attendees.length ? { attending: attendees.includes(name) } : {}),
        })).sort((a: any, b: any) => b.count - a.count),
      },
    ]));
    return success(result);
  }
  return null;
}