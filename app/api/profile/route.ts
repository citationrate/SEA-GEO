import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await (supabase.from("profiles") as any)
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const supabase = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const { error } = await (supabase.from("profiles") as any)
    .update(allowed)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
