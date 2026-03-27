import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { z } from "zod";

const schema = z.object({
  user_id: z.string().uuid(),
  queries_added: z.number().int().positive(),
  package_type: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const { data: profile } = await (supabase!.from("profiles") as any)
      .select("is_admin")
      .eq("id", user!.id)
      .single();
    const isAdmin = (profile as any)?.is_admin === true || user!.email?.endsWith("@seageo.it");
    if (!isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

    const { error: dbErr } = await (supabase!.from("package_purchases") as any).insert({
      user_id: parsed.data.user_id,
      queries_added: parsed.data.queries_added,
      package_type: parsed.data.package_type,
      status: "completed",
      stripe_payment_intent_id: `manual_${Date.now()}`,
    });

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
