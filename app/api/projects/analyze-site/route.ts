import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const schema = z.object({
  url: z.string().min(1),
});

export interface SiteAnalysis {
  main_service: string;
  target_audience: string;
  value_proposition: string;
  sector_keywords: string[];
  competitor_signals: string[];
  tone: string;
  geography: string;
}

/** Fetch a single page and extract text content (10s timeout) */
async function fetchPageText(pageUrl: string): Promise<{ title: string; description: string; headings: string[]; text: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "AVI-Bot/1.0 (AI Visibility Analysis)" },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
    const description = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1]?.trim() ?? "";
    const headings = [
      ...Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)).map((m) => m[1].replace(/<[^>]+>/g, "").trim()),
      ...Array.from(html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)).map((m) => m[1].replace(/<[^>]+>/g, "").trim()),
    ].filter((h) => h.length > 2 && h.length < 200).slice(0, 15);

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    let text = "";
    if (bodyMatch) {
      text = bodyMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<header[\s\S]*?<\/header>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2000);
    }

    // Extract internal links for about/services pages
    const links: string[] = [];
    const base = new URL(pageUrl);
    const priorityPaths = ["/about", "/chi-siamo", "/azienda", "/company", "/servizi", "/services", "/cosa-facciamo", "/what-we-do"];
    const hrefMatches = Array.from(html.matchAll(/href=["']([^"'#]+)["']/gi));
    for (const match of hrefMatches) {
      try {
        const resolved = new URL(match[1].trim(), pageUrl);
        if (resolved.hostname !== base.hostname) continue;
        if (priorityPaths.some((p) => resolved.pathname.toLowerCase().includes(p))) {
          links.push(resolved.origin + resolved.pathname);
        }
      } catch { /* invalid URL */ }
    }

    return { title, description, headings, text, ...({ _links: Array.from(new Set(links)).slice(0, 2) } as any) };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "URL non valido" }, { status: 400 });

    let baseUrl = parsed.data.url.trim();
    if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;

    // Fetch homepage
    const homepage = await fetchPageText(baseUrl);
    if (!homepage) {
      return NextResponse.json({ error: "Impossibile raggiungere il sito" }, { status: 422 });
    }

    // Fetch up to 2 key internal pages (about/services)
    const internalLinks: string[] = (homepage as any)._links ?? [];
    const internalPages = await Promise.all(
      internalLinks.map((link: string) => fetchPageText(link))
    );

    // Build content for analysis
    const allPages = [homepage, ...internalPages.filter(Boolean)];
    const content = allPages.map((page: any) => {
      const parts: string[] = [];
      if (page.title) parts.push(`Title: ${page.title}`);
      if (page.description) parts.push(`Description: ${page.description}`);
      if (page.headings?.length) parts.push(`Headings: ${page.headings.join(" | ")}`);
      if (page.text) parts.push(page.text.slice(0, 1500));
      return parts.join("\n");
    }).join("\n\n---\n\n");

    // Call Claude Haiku for analysis
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Analyze this website and extract structured information. Return JSON only, no other text.

Website content:
${content.slice(0, 4000)}

Extract:
1. main_service: What is the primary service/product offered? (1-2 sentences)
2. target_audience: Who are the customers? (B2B/B2C, demographics, profession)
3. value_proposition: What makes this brand unique? (1-2 sentences)
4. sector_keywords: 5-10 keywords that describe the sector (array of strings)
5. competitor_signals: Any competitors or similar brands mentioned on the site (array of company names, empty if none found)
6. tone: One of: professional, friendly, luxury, budget, technical
7. geography: One of: local, national, international

Return ONLY valid JSON:
{"main_service": "...", "target_audience": "...", "value_proposition": "...", "sector_keywords": [...], "competitor_signals": [...], "tone": "...", "geography": "..."}`,
      }],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let analysis: SiteAnalysis;
    try {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] ?? cleaned);
      analysis = {
        main_service: parsed.main_service ?? "",
        target_audience: parsed.target_audience ?? "",
        value_proposition: parsed.value_proposition ?? "",
        sector_keywords: Array.isArray(parsed.sector_keywords) ? parsed.sector_keywords : [],
        competitor_signals: Array.isArray(parsed.competitor_signals) ? parsed.competitor_signals : [],
        tone: parsed.tone ?? "professional",
        geography: parsed.geography ?? "national",
      };
    } catch {
      return NextResponse.json({ error: "Analisi del sito fallita" }, { status: 500 });
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[analyze-site] error:", err);
    return NextResponse.json({ error: "Errore nell'analisi del sito" }, { status: 500 });
  }
}
