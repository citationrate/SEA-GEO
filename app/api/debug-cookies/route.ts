import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = cookies();
  const all = cookieStore.getAll();
  const sb = all.filter(c => c.name.startsWith("sb-"));

  // Try to manually extract and verify the token
  let manualDecode: any = { status: "not attempted" };

  // Find the auth cookie (single or chunked)
  const single = sb.find(c => c.name === "sb-auth-auth-token");
  const chunk0 = sb.find(c => c.name === "sb-auth-auth-token.0");

  let raw = "";
  if (single) {
    raw = single.value;
  } else if (chunk0) {
    const chunks: string[] = [];
    for (let i = 0; ; i++) {
      const chunk = sb.find(c => c.name === `sb-auth-auth-token.${i}`);
      if (!chunk) break;
      chunks.push(chunk.value);
    }
    raw = chunks.join("");
  }

  if (raw) {
    try {
      // Strip base64- prefix if present
      let cookieValue = raw;
      if (cookieValue.startsWith("base64-")) {
        cookieValue = cookieValue.slice(7);
      }

      // Try decoding
      let session: any = null;
      try {
        const decoded = Buffer.from(cookieValue, "base64").toString();
        session = JSON.parse(decoded);
      } catch {
        try { session = JSON.parse(cookieValue); } catch {}
        try { session = JSON.parse(decodeURIComponent(cookieValue)); } catch {}
      }

      if (session?.access_token) {
        // Decode JWT header to see
        const jwtParts = session.access_token.split(".");
        const jwtPayload = JSON.parse(Buffer.from(jwtParts[1], "base64url").toString());

        // Try calling Supabase directly with this token
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          },
        });
        const userData = await res.json();

        manualDecode = {
          status: "decoded",
          has_access_token: true,
          has_refresh_token: !!session.refresh_token,
          jwt_sub: jwtPayload.sub,
          jwt_exp: jwtPayload.exp,
          jwt_exp_date: new Date(jwtPayload.exp * 1000).toISOString(),
          jwt_expired: jwtPayload.exp * 1000 < Date.now(),
          jwt_iss: jwtPayload.iss,
          jwt_aud: jwtPayload.aud,
          supabase_api_status: res.status,
          supabase_api_user_id: userData?.id || null,
          supabase_api_error: userData?.error || userData?.msg || null,
        };
      } else {
        manualDecode = { status: "no_access_token", raw_preview: raw.substring(0, 50), session_keys: session ? Object.keys(session) : null };
      }
    } catch (err: any) {
      manualDecode = { status: "error", message: err.message };
    }
  }

  return NextResponse.json({
    total_cookies: all.length,
    sb_cookie_names: sb.map(c => c.name),
    sb_cookie_lengths: sb.map(c => ({ name: c.name, len: c.value.length })),
    manual_decode: manualDecode,
    env: {
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  });
}
