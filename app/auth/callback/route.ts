import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  if (code) {
    const auth = createServerClient();
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (!error) {
      // Password recovery flow → redirect to update password page
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/update-password`);
      }

      // Check if this is a new user (onboarding not completed)
      const { data: { user } } = await auth.auth.getUser();
      if (user) {
        const supabase = createDataClient();
        const { data: profile } = await (supabase.from("profiles") as any)
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();
        if (!profile?.onboarding_completed) {
          return NextResponse.redirect(`${origin}/dashboard?welcome=1`);
        }
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
