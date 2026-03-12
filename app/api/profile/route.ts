import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error } = await (supabase.from("profiles") as any)
    .update(allowed)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
