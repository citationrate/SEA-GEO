import { NextResponse } from "next/server";
import { extractFromResponse } from "@/lib/engine/extractor";

export async function GET() {
  const testResponse = `Alcuni negozi online specializzati in prodotti per bambini che operano in Italia includono:
1. **Chicco** - Offre una vasta gamma di prodotti per neonati.
2. **Prénatal** - Specializzato in abbigliamento e accessori per bambini.
3. **Bimbostore** - Offre prodotti per bambini con opzioni di consegna veloce.`;

  const keyPresent = !!process.env.ANTHROPIC_API_KEY;
  const keyPrefix = process.env.ANTHROPIC_API_KEY?.substring(0, 10) ?? "MISSING";

  try {
    const result = await extractFromResponse(
      testResponse,
      "elevenbaby",
      "negozio per l'infanzia",
      "retailer",
      "it",
      null,
    );

    return NextResponse.json({
      keyPresent,
      keyPrefix,
      extraction: {
        brand_mentioned: result.brand_mentioned,
        competitors_count: result.competitors_found.length,
        competitors: result.competitors_found.map(c => c.name),
        topics: result.topics,
        _extractionError: result._extractionError ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({
      keyPresent,
      keyPrefix,
      error: e.message,
      stack: e.stack?.split("\n").slice(0, 5),
    }, { status: 500 });
  }
}
