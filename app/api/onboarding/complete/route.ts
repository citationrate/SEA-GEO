import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

export async function POST() {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const { error: dbError } = await (supabase.from("profiles") as any)
    .update({ onboarding_completed: true })
    .eq("id", user.id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
