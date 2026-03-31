import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
  const cookieStore = cookies();
  const all = cookieStore.getAll();
  const sb = all.filter(c => c.name.startsWith("sb-"));

  // Try to read session exactly like the middleware does
  let sessionResult: string = "not attempted";
  let userId: string | null = null;
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      {
        auth: { storageKey: "auth" },
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session?.user) {
      sessionResult = "OK";
      userId = session.user.id;
    } else {
      sessionResult = `FAILED: ${error?.message ?? "no session"}`;
    }
  } catch (err: any) {
    sessionResult = `ERROR: ${err.message}`;
  }

  return NextResponse.json({
    total_cookies: all.length,
    sb_cookies: sb.map(c => ({ name: c.name, len: c.value.length, preview: c.value.substring(0, 30) + "..." })),
    session: sessionResult,
    user_id: userId,
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 40),
  });
}
