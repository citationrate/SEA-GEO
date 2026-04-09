import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { addToWallet, ensureUserUsage } from "@/lib/usage";

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
    const crSvc = createCitationRateServiceClient();

    console.log("[voucher] Looking up code:", code.toUpperCase(), "user:", user.id);

    // Look up voucher in DB
    const { data: voucher, error: vErr } = await (svc.from("vouchers") as any)
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("is_used", false)
      .single();

    console.log("[voucher] lookup result:", JSON.stringify({ voucher: voucher?.id, type: voucher?.type, plan: voucher?.plan, error: vErr?.message }));

    if (vErr || !voucher) {
      return NextResponse.json({ error: "Codice voucher non valido o già utilizzato." }, { status: 400 });
    }

    // Check expiry
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
      return NextResponse.json({ error: "Codice voucher scaduto." }, { status: 400 });
    }

    const type = voucher.type || "plan_upgrade";
    const messages: string[] = [];

    // Ensure user_usage row exists / cycle is current before any mutation
    await ensureUserUsage(user.id);

    // ── Plan upgrade (CitationRate is source of truth + seageo1 shadow) ──
    if ((type === "plan_upgrade" || type === "combo") && voucher.plan) {
      const planUpdate = {
        plan: voucher.plan,
        subscription_status: voucher.plan === "demo" ? "inactive" : "active",
      };
      await (crSvc.from("profiles") as any)
        .update(planUpdate)
        .eq("id", user.id);
      await (svc.from("profiles") as any)
        .update(planUpdate)
        .eq("id", user.id);
      console.log("[voucher] plan synced to:", voucher.plan);
      messages.push(`Piano ${voucher.plan.charAt(0).toUpperCase() + voucher.plan.slice(1)} attivato`);
    }

    // ── Usage reset (start a fresh 30-day cycle on CitationRate) ──
    if ((type === "usage_reset" || type === "combo") && voucher.reset_usage) {
      const now = new Date();
      const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await (crSvc.from("user_usage") as any)
        .update({
          cycle_start: now.toISOString(),
          cycle_end: end.toISOString(),
          browsing_prompts_used: 0,
          no_browsing_prompts_used: 0,
          comparisons_used: 0,
          prompts_used: 0,
          cs_audits_used: 0,
          url_analyses_used: 0,
          context_analyses_used: 0,
          updated_at: now.toISOString(),
        })
        .eq("user_id", user.id);
      messages.push("Contatori azzerati");
    }

    // ── Query / comparison credits → wallet on seageo1.query_wallet ──
    const extraBrowsing = Number(voucher.extra_browsing_prompts) || 0;
    const extraNoBrowsing = Number(voucher.extra_no_browsing_prompts) || 0;
    const extraComparisons = Number(voucher.extra_comparisons) || 0;
    const hasCredits = extraBrowsing > 0 || extraNoBrowsing > 0 || extraComparisons > 0;

    if (hasCredits) {
      await addToWallet(user.id, extraBrowsing, extraNoBrowsing, extraComparisons);
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
