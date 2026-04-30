import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { sendMetaEvent, extractClientIp, readCookie, type MetaCustomData } from "@/lib/meta-capi";

const ALLOWED_CLIENT_EVENTS = new Set([
  "Lead",
  "CompleteRegistration",
  "ViewContent",
  "InitiateCheckout",
  "PageView",
  "Search",
  "AddToCart",
  "StartTrial",
  "AuditCompleted",
]);

interface TrackRequestBody {
  event_name: string;
  event_id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  external_id?: string;
  custom_data?: MetaCustomData;
  event_source_url?: string;
}

export async function POST(request: Request) {
  let body: TrackRequestBody;
  try {
    body = (await request.json()) as TrackRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { event_name, event_id } = body;
  if (!event_name || typeof event_name !== "string") {
    return NextResponse.json({ error: "missing_event_name" }, { status: 400 });
  }
  if (!event_id || typeof event_id !== "string") {
    return NextResponse.json({ error: "missing_event_id" }, { status: 400 });
  }
  if (!ALLOWED_CLIENT_EVENTS.has(event_name)) {
    return NextResponse.json({ error: "event_not_allowed" }, { status: 400 });
  }

  let externalId: string | undefined = body.external_id;
  let email = body.email;
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      externalId = user.id;
      if (!email) email = user.email ?? undefined;
    }
  } catch {
    // Unauthenticated request — fine, send what we have.
  }

  const fbp = readCookie(request, "_fbp");
  const fbc = readCookie(request, "_fbc");
  const ip = extractClientIp(request);
  const ua = request.headers.get("user-agent") ?? undefined;

  const result = await sendMetaEvent({
    event_name,
    event_id,
    event_source_url: body.event_source_url,
    user_data: {
      email,
      first_name: body.first_name,
      last_name: body.last_name,
      external_id: externalId,
      client_ip_address: ip,
      client_user_agent: ua,
      fbp,
      fbc,
    },
    custom_data: body.custom_data,
  });

  return NextResponse.json({ ok: result.ok });
}
