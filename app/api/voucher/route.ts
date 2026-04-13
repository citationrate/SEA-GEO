import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

const CR_API_URL = process.env.CITATIONRATE_API_URL || "https://citationrate-backend-production.up.railway.app";

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const code = (body.code || "").trim().toUpperCase();
    if (!code) return NextResponse.json({ error: "Codice non valido" }, { status: 400 });

    // Get auth token from CitationRate (shared auth)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    // Call CitationRate backend coupon redeem
    const res = await fetch(`${CR_API_URL}/coupons/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();

    if (!res.ok) {
      const detail = data.detail || "Errore sconosciuto";
      const errorMap: Record<string, string> = {
        "Coupon not found or inactive": "Codice coupon non valido o non attivo.",
        "Coupon has expired": "Codice coupon scaduto.",
        "Coupon has been fully redeemed": "Codice coupon esaurito.",
        "You have already redeemed this coupon": "Hai già utilizzato questo coupon.",
      };
      return NextResponse.json({ error: errorMap[detail] || detail }, { status: res.status });
    }

    const applied = data.applied || {};
    const messages: string[] = [];
    if (applied.plan) messages.push(`Piano ${applied.plan.charAt(0).toUpperCase() + applied.plan.slice(1)} attivato`);
    if (applied.cs_extra_audits_added) messages.push(`+${applied.cs_extra_audits_added} audit extra`);
    if (applied.avi_browsing_queries_added) messages.push(`+${applied.avi_browsing_queries_added} query browsing`);
    if (applied.avi_no_browsing_queries_added) messages.push(`+${applied.avi_no_browsing_queries_added} query standard`);
    if (applied.discount_pct) messages.push(`Sconto ${applied.discount_pct}% applicato al prossimo acquisto`);

    const message = messages.length > 0
      ? messages.join(" + ") + "!"
      : "Coupon riscattato con successo!";

    return NextResponse.json({ message });
  } catch (err) {
    console.error("[voucher] error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
