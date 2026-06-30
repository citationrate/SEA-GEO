import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDataClient } from "@/lib/supabase/server";
import { checkAndIncrementHaikuLimit, HAIKU_DAILY_LIMIT } from "@/lib/haiku-rate-limit";
import { analyzeSite, type SiteAnalysis } from "@/lib/site-analysis";

// Re-exported for backwards compatibility — the crawl/analysis engine now lives
// in lib/site-analysis.ts so the suite seed flow can reuse it.
export type { SiteAnalysis };

const schema = z.object({
  url: z.string().min(1),
  language: z.enum(["it", "en", "fr", "de", "es"]).default("it"),
});

export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "URL non valido" }, { status: 400 });

    // Haiku daily quota — consumed pre-call regardless of fetch success.
    const limit = await checkAndIncrementHaikuLimit(createDataClient(), user.id);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Daily AI limit reached", limit: HAIKU_DAILY_LIMIT },
        { status: 429 },
      );
    }

    const result = await analyzeSite(parsed.data.url, parsed.data.language);
    if (!result.ok) {
      if (result.reason === "ssrf") return NextResponse.json({ error: "URL non valido" }, { status: 400 });
      if (result.reason === "unreachable") return NextResponse.json({ error: "Impossibile raggiungere il sito" }, { status: 422 });
      return NextResponse.json({ error: "Analisi del sito fallita" }, { status: 500 });
    }

    return NextResponse.json({ analysis: result.analysis });
  } catch (err) {
    console.error("[analyze-site] error:", err);
    return NextResponse.json({ error: "Errore nell'analisi del sito" }, { status: 500 });
  }
}
