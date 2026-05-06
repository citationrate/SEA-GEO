import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";

export type DiagnosticPillar = "clarity" | "authority" | "relevance";
export type DiagnosticStatus = "fail" | "partial" | "pass";

export const PARAM_MAP: Record<DiagnosticPillar, string[]> = {
  clarity: ["P1", "P3", "P5", "P6", "P7", "P8", "P42", "P57"],
  authority: ["P9", "P10", "P11", "P13", "P16", "P43", "P44"],
  relevance: ["P17", "P18", "P22", "P26", "P27", "P31", "P49"],
};

export interface DiagnosticEntry {
  pillar: DiagnosticPillar;
  cs_parameter_id: string;
  cs_status: DiagnosticStatus;
  cs_audit_id: string;
  cs_audit_date: string;
  note?: string;
}

interface BridgeContext {
  userId: string;
  brandUrl?: string | null;
}

interface AuditRow {
  id: string;
  urls: string[] | null;
  created_at: string;
  parameters: Record<string, { name?: string; score?: number }> | null;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function statusFromScore(score: number): DiagnosticStatus {
  if (score >= 1.7) return "pass";
  if (score <= 0.3) return "fail";
  return "partial";
}

/**
 * Fetch the most recent CS audit (≤90 days) whose URL matches the brand's
 * hostname and map its parameter scores to Brand Profile diagnostics.
 *
 * Real audit shape (CR public.audits):
 *   urls       text[]           — array of audited URLs
 *   created_at timestamptz      — there is NO completed_at column
 *   parameters jsonb            — { "P1": { "name": "...", "score": 0..2 } }
 *
 * Score → status mapping: 0 = fail, 2 = pass, anything else = partial.
 * Returns [] if nothing matches; non-fatal for the pipeline.
 */
export async function fetchCSDiagnostics(ctx: BridgeContext): Promise<DiagnosticEntry[]> {
  if (!ctx.brandUrl) return [];
  const targetHost = hostnameOf(ctx.brandUrl);
  if (!targetHost) return [];

  const cr = createCitationRateServiceClient();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: audits, error } = await (cr.from("audits") as any)
    .select("id, urls, created_at, parameters")
    .eq("user_id", ctx.userId)
    .eq("status", "completed")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[cs-bridge] audits fetch error:", error.message);
    return [];
  }
  if (!audits || audits.length === 0) return [];

  const match = (audits as AuditRow[]).find((a) =>
    Array.isArray(a.urls) &&
    a.urls.some((u) => {
      const h = hostnameOf(u);
      return h === targetHost || (h !== null && (h.endsWith(`.${targetHost}`) || targetHost.endsWith(`.${h}`)));
    }) &&
    a.parameters != null &&
    typeof a.parameters === "object",
  );

  if (!match || !match.parameters) return [];

  const auditDate = match.created_at.slice(0, 10);
  const out: DiagnosticEntry[] = [];

  for (const [pillar, paramIds] of Object.entries(PARAM_MAP) as [DiagnosticPillar, string[]][]) {
    for (const pid of paramIds) {
      const param = match.parameters[pid];
      if (!param || typeof param.score !== "number") continue;
      out.push({
        pillar,
        cs_parameter_id: pid,
        cs_status: statusFromScore(Number(param.score)),
        cs_audit_id: match.id,
        cs_audit_date: auditDate,
        note: param.name ? String(param.name).slice(0, 240) : undefined,
      });
    }
  }

  return out;
}
