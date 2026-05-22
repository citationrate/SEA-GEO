import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Daily cleanup of expired Brand Profile prompt cache rows.
 *
 * The cache (`brand_profile.prompt_cache`) stores cross-brand reusable
 * responses for Recognition + Authority pillars with a 30-day TTL. Hits
 * extend implicit usefulness (`last_hit_at`, `hit_count`) but never
 * extend the TTL itself — the table would grow unbounded without this
 * cron. A daily DELETE on the expires_at index is fast (sub-second on
 * the indexed timestamp column).
 *
 * Triggered by Vercel Cron at 05:00 UTC daily (see `vercel.json`).
 * Auth via the standard CRON_SECRET bearer scheme.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const svc = createServiceClient();
    const nowIso = new Date().toISOString();
    const { data, error, count } = await (svc.schema("brand_profile" as any) as any)
      .from("prompt_cache")
      .delete({ count: "exact" })
      .lt("expires_at", nowIso)
      .select("cache_key");
    if (error) {
      console.error("[bp-prompt-cache-cleanup] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const deleted = (data?.length ?? count ?? 0) as number;
    return NextResponse.json({ ok: true, deleted, at: nowIso });
  } catch (err) {
    console.error("[bp-prompt-cache-cleanup] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
