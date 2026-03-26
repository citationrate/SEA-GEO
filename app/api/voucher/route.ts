import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z.object({ code: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Codice non valido" }, { status: 400 });

    const { code } = parsed.data;
    const svc = createServiceClient();

    // Look up voucher in DB
    const { data: voucher, error: vErr } = await (svc.from("vouchers") as any)
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

    const type = voucher.type || "plan_upgrade";
    const period = new Date().toISOString().slice(0, 7);
    const messages: string[] = [];

    // ── Plan upgrade ──
    if ((type === "plan_upgrade" || type === "combo") && voucher.plan) {
      await (svc.from("profiles") as any)
        .update({ plan: voucher.plan })
        .eq("id", user.id);
      messages.push(`Piano ${voucher.plan.charAt(0).toUpperCase() + voucher.plan.slice(1)} attivato`);
    }

    // ── Usage reset ──
    if ((type === "usage_reset" || type === "combo") && voucher.reset_usage) {
      const { data: existing } = await (svc.from("usage_monthly") as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("period", period)
        .maybeSingle();

      if (existing) {
        await (svc.from("usage_monthly") as any)
          .update({
            browsing_prompts_used: 0,
            no_browsing_prompts_used: 0,
            comparisons_used: 0,
            prompts_used: 0,
          })
          .eq("user_id", user.id)
          .eq("period", period);
      }
      messages.push("Contatori azzerati");
    }

    // ── Query / comparison credits ──
    const extraBrowsing = Number(voucher.extra_browsing_prompts) || 0;
    const extraNoBrowsing = Number(voucher.extra_no_browsing_prompts) || 0;
    const extraComparisons = Number(voucher.extra_comparisons) || 0;
    const hasCredits = extraBrowsing > 0 || extraNoBrowsing > 0 || extraComparisons > 0;

    if (hasCredits) {
      const { data: existing } = await (svc.from("usage_monthly") as any)
        .select("extra_browsing_prompts, extra_no_browsing_prompts, extra_comparisons")
        .eq("user_id", user.id)
        .eq("period", period)
        .maybeSingle();

      const newBrowsing = (Number(existing?.extra_browsing_prompts) || 0) + extraBrowsing;
      const newNoBrowsing = (Number(existing?.extra_no_browsing_prompts) || 0) + extraNoBrowsing;
      const newComparisons = (Number(existing?.extra_comparisons) || 0) + extraComparisons;

      if (existing) {
        await (svc.from("usage_monthly") as any)
          .update({
            extra_browsing_prompts: newBrowsing,
            extra_no_browsing_prompts: newNoBrowsing,
            extra_comparisons: newComparisons,
          })
          .eq("user_id", user.id)
          .eq("period", period);
      } else {
        await (svc.from("usage_monthly") as any)
          .insert({
            user_id: user.id,
            period,
            browsing_prompts_used: 0,
            no_browsing_prompts_used: 0,
            prompts_used: 0,
            comparisons_used: 0,
            extra_browsing_prompts: extraBrowsing,
            extra_no_browsing_prompts: extraNoBrowsing,
            extra_comparisons: extraComparisons,
          });
      }

      const parts: string[] = [];
      if (extraBrowsing > 0) parts.push(`+${extraBrowsing} query browsing`);
      if (extraNoBrowsing > 0) parts.push(`+${extraNoBrowsing} query standard`);
      if (extraComparisons > 0) parts.push(`+${extraComparisons} confronti`);
      messages.push(parts.join(", "));
    }

    // Mark voucher as used
    await (svc.from("vouchers") as any)
      .update({ is_used: true, used_by: user.id, used_at: new Date().toISOString() })
      .eq("id", voucher.id);

    const message = messages.length > 0
      ? messages.join(" + ") + "!"
      : "Voucher riscattato con successo!";

    console.log("[voucher] Redeemed:", code, "by:", user.id, "→", message);

    return NextResponse.json({ message });
  } catch (err) {
    console.error("[voucher] error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
