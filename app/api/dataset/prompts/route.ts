import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const runId = request.nextUrl.searchParams.get("run_id");
    if (!runId) return NextResponse.json({ error: "run_id richiesto" }, { status: 400 });

    // Fetch prompts executed for this run
    const { data: prompts, error: pErr } = await (supabase.from("prompts_executed") as any)
      .select("id, query_id, model, run_number, raw_response, executed_at, error")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    const promptsList = (prompts ?? []) as any[];
    if (promptsList.length === 0) return NextResponse.json([]);

    // Fetch query metadata for all query_ids
    const queryIds = Array.from(new Set(promptsList.map((p: any) => p.query_id).filter(Boolean)));
    const { data: queries } = queryIds.length > 0
      ? await supabase.from("queries").select("id, text, funnel_stage, set_type, layer, persona_mode").in("id", queryIds)
      : { data: [] };
    const queryMap = new Map((queries ?? []).map((q: any) => [q.id, q]));

    // Fetch response_analysis for all prompt IDs
    const promptIds = promptsList.map((p: any) => p.id);
    const { data: analyses } = promptIds.length > 0
      ? await supabase.from("response_analysis").select("prompt_executed_id, brand_mentioned, brand_rank, sentiment_score, competitors_found").in("prompt_executed_id", promptIds)
      : { data: [] };
    const analysisMap = new Map((analyses ?? []).map((a: any) => [a.prompt_executed_id, a]));

    // Fetch sources for all prompt IDs
    const { data: sources } = promptIds.length > 0
      ? await supabase.from("sources").select("prompt_executed_id, url, domain, label, source_type").in("prompt_executed_id", promptIds)
      : { data: [] };
    const sourcesMap = new Map<string, any[]>();
    for (const s of (sources ?? []) as any[]) {
      const key = s.prompt_executed_id;
      if (!sourcesMap.has(key)) sourcesMap.set(key, []);
      sourcesMap.get(key)!.push(s);
    }

    // Build response rows
    const rows = promptsList.map((p: any) => {
      const q = queryMap.get(p.query_id);
      const a = analysisMap.get(p.id);
      return {
        id: p.id,
        query_id: p.query_id,
        query_text: q?.text ?? "—",
        funnel_stage: q?.funnel_stage ?? "tofu",
        set_type: q?.set_type ?? "manual",
        layer: q?.layer ?? null,
        persona_mode: q?.persona_mode ?? null,
        model: p.model,
        run_number: p.run_number,
        raw_response: p.raw_response,
        executed_at: p.executed_at,
        error: p.error,
        brand_mentioned: a?.brand_mentioned ?? null,
        brand_rank: a?.brand_rank ?? null,
        sentiment_score: a?.sentiment_score ?? null,
        competitors_found: a?.competitors_found ?? null,
        sources: (sourcesMap.get(p.id) ?? []).map((s: any) => ({
          url: s.url,
          domain: s.domain,
          label: s.label,
          source_type: s.source_type,
        })),
      };
    });

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
