import { createHash } from "crypto";

const PIXEL_ID = process.env.META_PIXEL_ID || "";
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || "";
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || "";
const GRAPH_VERSION = "v21.0";

function sha256Lower(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return undefined;
  return createHash("sha256").update(trimmed).digest("hex");
}

export interface MetaUserData {
  email?: string;
  first_name?: string;
  last_name?: string;
  external_id?: string;
  client_ip_address?: string;
  client_user_agent?: string;
  fbp?: string;
  fbc?: string;
}

export interface MetaCustomData {
  currency?: string;
  value?: number;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  num_items?: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  [key: string]: unknown;
}

export interface MetaEventArgs {
  event_name: string;
  event_id: string;
  user_data: MetaUserData;
  custom_data?: MetaCustomData;
  event_source_url?: string;
  action_source?: "website" | "app" | "system_generated";
  event_time?: number;
}

function buildUserData(u: MetaUserData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const em = sha256Lower(u.email);
  if (em) out.em = [em];
  const fn = sha256Lower(u.first_name);
  if (fn) out.fn = [fn];
  const ln = sha256Lower(u.last_name);
  if (ln) out.ln = [ln];
  const eid = sha256Lower(u.external_id);
  if (eid) out.external_id = [eid];
  if (u.client_ip_address) out.client_ip_address = u.client_ip_address;
  if (u.client_user_agent) out.client_user_agent = u.client_user_agent;
  if (u.fbp) out.fbp = u.fbp;
  if (u.fbc) out.fbc = u.fbc;
  return out;
}

/**
 * Send an event to Meta Conversions API. No-op (with warn) if PIXEL_ID or
 * ACCESS_TOKEN are missing. Never throws — failures are logged and swallowed
 * so a tracking outage cannot break user-facing flows.
 */
export async function sendMetaEvent(args: MetaEventArgs): Promise<{ ok: boolean; error?: string }> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn("[meta-capi] Missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN — skipping");
    return { ok: false, error: "missing_config" };
  }

  const eventTime = args.event_time ?? Math.floor(Date.now() / 1000);
  const payload = {
    data: [
      {
        event_name: args.event_name,
        event_time: eventTime,
        event_id: args.event_id,
        action_source: args.action_source ?? "website",
        ...(args.event_source_url ? { event_source_url: args.event_source_url } : {}),
        user_data: buildUserData(args.user_data),
        ...(args.custom_data ? { custom_data: args.custom_data } : {}),
      },
    ],
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
  };

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`[meta-capi] ${args.event_name} HTTP ${res.status}: ${txt.slice(0, 300)}`);
      return { ok: false, error: `http_${res.status}` };
    }
    const json = await res.json().catch(() => null);
    console.log(`[meta-capi] ${args.event_name} sent event_id=${args.event_id} received=${json?.events_received ?? "?"}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[meta-capi] ${args.event_name} fetch failed: ${msg}`);
    return { ok: false, error: "fetch_failed" };
  }
}

export function extractClientIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  const parts = header.split(";");
  for (const part of parts) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
