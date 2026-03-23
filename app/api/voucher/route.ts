import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ code: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Codice non valido" }, { status: 400 });

    const { code } = parsed.data;

    // Look up voucher in DB
    const { data: voucher, error: vErr } = await (supabase.from("vouchers") as any)
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("is_used", false)
      .single();

    if (vErr || !voucher) {
      return NextResponse.json({ error: "Codice voucher non valido o già utilizzato." }, { status: 400 });
    }

    // Check expiry
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
      return NextResponse.json({ error: "Codice voucher scaduto." }, { status: 400 });
    }

    // Activate plan
    const targetPlan = voucher.plan || "pro";
    await (supabase.from("profiles") as any)
      .update({ plan: targetPlan })
      .eq("id", user.id);

    // Mark voucher as used
    await (supabase.from("vouchers") as any)
      .update({ is_used: true, used_by: user.id, used_at: new Date().toISOString() })
      .eq("id", voucher.id);

    return NextResponse.json({ message: `Piano ${targetPlan} attivato con successo!` });
  } catch (err) {
    console.error("[voucher] error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
