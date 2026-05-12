import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

function getCrmClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.CR_SERVICE_ROLE_KEY!
  );
}

// Create new session (or handle sendBeacon PUT via _method)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // sendBeacon can only POST — handle PUT via _method field
    if (body._method === "PUT") {
      const { session_id, events, duration_seconds } = body;
      if (!session_id || !events) return Response.json({ ok: true });
      const supabase = getCrmClient();
      const { data: current } = await supabase
        .from("session_recordings")
        .select("recording_data")
        .eq("id", session_id)
        .single();
      if (!current) return Response.json({ ok: true });
      const merged = [...((current.recording_data as any[]) || []), ...events];
      await supabase
        .from("session_recordings")
        .update({ recording_data: merged, events_count: merged.length, ended_at: new Date().toISOString(), duration_seconds: duration_seconds || 0 })
        .eq("id", session_id);
      return Response.json({ ok: true });
    }

    const { user_id, events, page_url } = body;
    if (!user_id || !events) return Response.json({ error: "Missing data" }, { status: 400 });

    const supabase = getCrmClient();
    const { data, error } = await supabase
      .from("session_recordings")
      .insert({
        user_id,
        page_url: page_url || null,
        source: "avi",
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 0,
        events_count: events.length,
        recording_data: events,
      })
      .select("id")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, id: data.id });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Append events to existing session
export async function PUT(req: NextRequest) {
  try {
    const { session_id, events, duration_seconds } = await req.json();
    if (!session_id || !events) return Response.json({ error: "Missing data" }, { status: 400 });

    const supabase = getCrmClient();

    // Get current recording data
    const { data: current } = await supabase
      .from("session_recordings")
      .select("recording_data, events_count")
      .eq("id", session_id)
      .single();

    if (!current) return Response.json({ error: "Session not found" }, { status: 404 });

    const existingEvents = (current.recording_data as any[]) || [];
    const merged = [...existingEvents, ...events];

    const { error } = await supabase
      .from("session_recordings")
      .update({
        recording_data: merged,
        events_count: merged.length,
        ended_at: new Date().toISOString(),
        duration_seconds: duration_seconds || 0,
      })
      .eq("id", session_id);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
