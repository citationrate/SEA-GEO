import { requireAuth } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { z } from "zod";

// Check if user is admin
async function requireAdmin() {
  const { supabase, user, error } = await requireAuth();
  if (error) return { error, user: null };
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("is_admin")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.is_admin === true;
  if (!isAdmin) return { error: NextResponse.json({ error: "Non autorizzato" }, { status: 403 }), user: null };
  return { user, error: null };
}

// GET — list all vouchers
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const svc = createServiceClient();
  const { data, error: dbErr } = await (svc.from("vouchers") as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ vouchers: data ?? [] });
}

// POST — create new voucher
const createSchema = z.object({
  code: z.string().min(3).max(30),
  type: z.enum(["plan_upgrade", "query_credit", "comparison_credit", "usage_reset", "combo"]),
  plan: z.string().optional(),
  extra_browsing_prompts: z.number().int().min(0).default(0),
  extra_no_browsing_prompts: z.number().int().min(0).default(0),
  extra_comparisons: z.number().int().min(0).default(0),
  reset_usage: z.boolean().default(false),
  description: z.string().optional(),
  expires_at: z.string().optional(), // ISO date
});

export async function POST(request: Request) {
  const { error, user } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
    }

    const svc = createServiceClient();
    const data = parsed.data;

    // Check code uniqueness
    const { data: existing } = await (svc.from("vouchers") as any)
      .select("id")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Codice già esistente" }, { status: 409 });
    }

    const { data: voucher, error: insertErr } = await (svc.from("vouchers") as any)
      .insert({
        code: data.code.toUpperCase(),
        type: data.type,
        plan: data.plan || null,
        extra_browsing_prompts: data.extra_browsing_prompts,
        extra_no_browsing_prompts: data.extra_no_browsing_prompts,
        extra_comparisons: data.extra_comparisons,
        reset_usage: data.reset_usage,
        description: data.description || null,
        expires_at: data.expires_at || null,
        is_used: false,
      })
      .select("*")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // M5: Admin audit log
    try {
      await (svc.from("admin_audit_log") as any).insert({
        admin_user_id: user!.id,
        action: "create_voucher",
        target_user_id: null,
        details: { code: data.code.toUpperCase(), type: data.type, plan: data.plan },
      });
    } catch (auditErr) {
      console.error("[vouchers] audit log insert failed:", auditErr);
    }

    return NextResponse.json({ voucher });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Errore interno" }, { status: 500 });
  }
}

// DELETE — delete a voucher
export async function DELETE(request: Request) {
  const { error, user } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id richiesto" }, { status: 400 });

  const svc = createServiceClient();
  await (svc.from("vouchers") as any).delete().eq("id", id);

  // M5: Admin audit log
  try {
    await (svc.from("admin_audit_log") as any).insert({
      admin_user_id: user!.id,
      action: "delete_voucher",
      target_user_id: null,
      details: { voucher_id: id },
    });
  } catch (auditErr) {
    console.error("[vouchers] audit log insert failed:", auditErr);
  }

  return NextResponse.json({ ok: true });
}
