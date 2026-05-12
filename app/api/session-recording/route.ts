import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

// Use CitationRate Supabase (same as CRM) for session recordings
function getCrmClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const { user_id, events, page_url, started_at, duration_seconds } = await req.json();

    if (!user_id || !events || !events.length) {
      return Response.json({ error: "Missing data" }, { status: 400 });
    }

    const supabase = getCrmClient();

    const { error } = await supabase.from("session_recordings").insert({
      user_id,
      page_url: page_url || null,
      started_at: started_at || new Date().toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: duration_seconds || 0,
      events_count: events.length,
      recording_data: events,
    });

    if (error) {
      console.error("[session-recording] save error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("[session-recording] error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
