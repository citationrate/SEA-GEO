import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Send password reset via Supabase Auth
    // The redirect URL must be whitelisted in Supabase dashboard
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: "https://avi.citationrate.com/auth/callback?next=/auth/update-password",
    });

    if (error) {
      console.error("[reset-password] Supabase error:", error.message, error.status);
      // Common case: email rate limit (Supabase limits to 1 reset per 60s)
      if (error.message.includes("rate") || error.status === 429) {
        return NextResponse.json({ error: "Attendi qualche minuto prima di riprovare." }, { status: 429 });
      }
      return NextResponse.json({ error: `Errore: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[reset-password] crash:", err?.message);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
