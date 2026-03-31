import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = cookies();
  const all = cookieStore.getAll();
  const sb = all.filter(c => c.name.startsWith("sb-"));
  return NextResponse.json({
    total_cookies: all.length,
    sb_cookies: sb.map(c => ({ name: c.name, len: c.value.length })),
    all_names: all.map(c => c.name),
  });
}
