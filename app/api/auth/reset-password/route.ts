import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  // Send password reset email via Supabase Auth (CitationRate project)
  // redirectTo points to AVI's auth callback so the user stays on this SaaS
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://avi.citationrate.com";
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${appUrl}/auth/callback`,
  });

  if (error) {
    console.error("[reset-password] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
