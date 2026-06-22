import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const auth = createServerClient();
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (!error) {
      // If a "next" param is set (e.g. password reset), redirect there
      const next = searchParams.get("next");
      if (next && next.startsWith("/")) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      // Onboarding gestito dalla suite (UX unificata): niente più redirect
      // ?welcome=1 / tour AVI. Si va dritti alla dashboard.
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
