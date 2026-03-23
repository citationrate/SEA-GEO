import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { isProUser } from "@/lib/utils/is-pro";

export async function GET() {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const { data, error: dbError } = await (supabase.from("profiles") as any)
    .select("*")
    .eq("id", user.id)
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // Enrich plan from user_metadata.is_pro (same logic as dashboard layout)
  const profile = data as any;
  if (isProUser(profile, user.user_metadata)) {
    profile.plan = profile.plan === "agency" ? "agency" : "pro";
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const body = await request.json();

  // Only allow specific fields to be updated
  const allowed: Record<string, unknown> = {};
  if (typeof body.onboarding_completed === "boolean") {
    allowed.onboarding_completed = body.onboarding_completed;
  }
  if (typeof body.full_name === "string") {
    allowed.full_name = body.full_name.trim().slice(0, 100);
  }
  if (typeof body.notify_analysis_complete === "boolean") {
    allowed.notify_analysis_complete = body.notify_analysis_complete;
  }
  if (typeof body.notify_competitor_alert === "boolean") {
    allowed.notify_competitor_alert = body.notify_competitor_alert;
  }
  if (Array.isArray(body.preferred_models)) {
    allowed.preferred_models = body.preferred_models.filter((m: unknown) => typeof m === "string");
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error: dbError } = await (supabase.from("profiles") as any)
    .update(allowed)
    .eq("id", user.id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
