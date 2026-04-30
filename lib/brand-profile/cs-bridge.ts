import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";

export type DiagnosticPillar = "clarity" | "authority" | "relevance";

export const PARAM_MAP: Record<DiagnosticPillar, string[]> = {
  clarity: ["P1", "P3", "P5", "P6", "P7", "P8", "P42", "P57"],
  authority: ["P9", "P10", "P11", "P13", "P16", "P43", "P44"],
  relevance: ["P17", "P18", "P22", "P26", "P27", "P31", "P49"],
};

export interface DiagnosticEntry {
  pillar: DiagnosticPillar;
  cs_parameter_id: string;
  cs_status: string;
  cs_audit_id: string;
  cs_audit_date: string;
  note?: string;
}

interface BridgeContext {
  userId: string;
  brandUrl?: string | null;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Fetch the most recent CS audit for the user (≤90 days) and map its
 * parameter statuses to Brand Profile diagnostics.
 *
 * F2 stub: returns [] when no audit is found or fields are missing.
 * Full population happens in F2 once the CS audit row shape is finalized.
 */
export async function fetchCSDiagnostics(ctx: BridgeContext): Promise<DiagnosticEntry[]> {
  if (!ctx.brandUrl) return [];
  const host = hostnameOf(ctx.brandUrl);
  if (!host) return [];

  const cr = createCitationRateServiceClient();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: audit } = await (cr.from("audits") as any)
    .select("id, url, completed_at, parameters")
    .eq("user_id", ctx.userId)
    .ilike("url", `%${host}%`)
    .gte("completed_at", since)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!audit || !audit.parameters) return [];

  const auditDate = (audit.completed_at as string).slice(0, 10);
  const out: DiagnosticEntry[] = [];

  for (const [pillar, paramIds] of Object.entries(PARAM_MAP) as [DiagnosticPillar, string[]][]) {
    for (const pid of paramIds) {
      const param = (audit.parameters as Record<string, { status?: string; note?: string }>)[pid];
      if (!param || !param.status) continue;
      out.push({
        pillar,
        cs_parameter_id: pid,
        cs_status: param.status,
        cs_audit_id: audit.id as string,
        cs_audit_date: auditDate,
        note: param.note,
      });
    }
  }

  return out;
}
