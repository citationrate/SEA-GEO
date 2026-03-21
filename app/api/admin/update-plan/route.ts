import { createServiceClient } from "@/lib/supabase/service";
import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  user_id: z.string().uuid(),
  plan: z.enum(["demo", "free", "base", "pro", "agency"]),
});

export async function POST(request: Request) {
  try {
    // Verify caller is admin
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: callerProfile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    const isAdmin = (callerProfile as any)?.is_admin === true || user.email?.endsWith("@seageo.it");
    if (!isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

    const svc = createServiceClient();
    const { error } = await svc.from("profiles").update({ plan: parsed.data.plan }).eq("id", parsed.data.user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
