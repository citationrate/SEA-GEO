import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const schema = z.object({
  project_id: z.string().uuid(),
  count: z.number().int().min(1).max(100),
  tofu_pct: z.number().min(0).max(100).default(60),
});

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { project_id, count, tofu_pct } = parsed.data;

    // Load project with all context
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    const p = project as any;

    // Fetch website content for context if URL is provided
    let websiteContext = "";
    if (p.website_url) {
      try {
        websiteContext = await fetchWebsiteContext(p.website_url);
        console.log(`[ai-generate] website context extracted: ${websiteContext.length} chars`);
      } catch (err) {
        console.warn(`[ai-generate] website fetch failed for ${p.website_url}:`, err instanceof Error ? err.message : err);
      }
    }

    // Load existing queries to avoid duplicates
    const { data: existingQueries } = await supabase
      .from("queries")
      .select("text")
      .eq("project_id", project_id);

    const existingTexts = (existingQueries ?? []).map((q: any) => q.text);

    const nTofu = Math.round(count * (tofu_pct / 100));
    const nMofu = count - nTofu;

    const systemPrompt = buildSystemPrompt(p, existingTexts, count, nTofu, nMofu, websiteContext);

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // First generation call
    let queries = await callGeneration(anthropic, systemPrompt, count);

    // If under-count, make a second call for the missing ones
    if (queries.length < count) {
      const missing = count - queries.length;
      const alreadyGenerated = queries.map((q) => q.text);
      const nTofuHave = queries.filter((q) => q.funnel_stage === "TOFU").length;
      const nMofuHave = queries.filter((q) => q.funnel_stage === "MOFU").length;
      const nTofuMissing = Math.max(0, nTofu - nTofuHave);
      const nMofuMissing = Math.max(0, nMofu - nMofuHave);

      const followUpPrompt = buildFollowUpPrompt(p, [...existingTexts, ...alreadyGenerated], missing, nTofuMissing, nMofuMissing);
      const extra = await callGeneration(anthropic, followUpPrompt, missing);
      queries = [...queries, ...extra];
    }

    // Trim to exact count if over
    queries = queries.slice(0, count);

    return NextResponse.json({ queries }, { status: 200 });
  } catch (err) {
    console.error("[ai-generate] error:", err);
    return NextResponse.json({ error: "Errore nella generazione" }, { status: 500 });
  }
}

interface AIQuery {
  text: string;
  funnel_stage: "TOFU" | "MOFU";
}

async function callGeneration(anthropic: Anthropic, prompt: string, expectedCount: number): Promise<AIQuery[]> {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "[]";
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  try {
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((q: any) => typeof q.text === "string" && q.text.trim().length > 10)
      .map((q: any) => ({
        text: q.text.trim(),
        funnel_stage: q.funnel_stage === "MOFU" ? "MOFU" as const : "TOFU" as const,
      }));
  } catch {
    console.error("[ai-generate] JSON parse failed:", cleaned.substring(0, 300));
    return [];
  }
}

/** Fetch a single page and extract structured content */
async function fetchPage(pageUrl: string): Promise<{ url: string; title: string; description: string; headings: string[]; text: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "SeaGeo-Bot/1.0 (AI Visibility Analysis)" },
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
    ].filter((h) => h.length > 2 && h.length < 200).slice(0, 10);

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
        .slice(0, 1500);
    }
    return { url: pageUrl, title, description, headings, text };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/** Extract internal links from HTML that are likely content pages */
function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const links = new Set<string>();

  // Priority paths to look for
  const priorityPaths = [
    "/about", "/chi-siamo", "/chi_siamo", "/azienda", "/company",
    "/servizi", "/services", "/prodotti", "/products",
    "/soluzioni", "/solutions", "/cosa-facciamo", "/what-we-do",
    "/team", "/il-team", "/contatti", "/contact",
    "/prezzi", "/pricing", "/piani", "/plans",
    "/blog", "/news", "/risorse", "/resources",
    "/casi-studio", "/case-studies", "/portfolio", "/clienti", "/clients",
    "/vantaggi", "/benefits", "/features", "/funzionalita",
  ];

  // Find all <a href="..."> in the HTML
  const hrefMatches = Array.from(html.matchAll(/href=["']([^"'#]+)["']/gi));
  for (const match of hrefMatches) {
    let href = match[1].trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;

    try {
      const resolved = new URL(href, baseUrl);
      // Same domain only
      if (resolved.hostname !== base.hostname) continue;
      // Skip assets
      if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|pdf|zip|mp4|webp|woff|ttf)$/i.test(resolved.pathname)) continue;
      links.add(resolved.origin + resolved.pathname);
    } catch { /* invalid URL */ }
  }

  // Sort: priority paths first, then by path length (shorter = more important)
  const sorted = Array.from(links).sort((a, b) => {
    const pathA = new URL(a).pathname.toLowerCase();
    const pathB = new URL(b).pathname.toLowerCase();
    const prioA = priorityPaths.some((p) => pathA.includes(p)) ? 0 : 1;
    const prioB = priorityPaths.some((p) => pathB.includes(p)) ? 0 : 1;
    if (prioA !== prioB) return prioA - prioB;
    return pathA.length - pathB.length;
  });

  // Remove homepage (already fetched) and limit
  return sorted.filter((u) => new URL(u).pathname !== "/" && new URL(u).pathname !== base.pathname).slice(0, 7);
}

/** Crawl website: homepage + up to 7 internal pages */
async function fetchWebsiteContext(url: string): Promise<string> {
  let baseUrl = url.trim();
  if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;

  // 1. Fetch homepage
  const homepage = await fetchPage(baseUrl);
  if (!homepage) return "";

  // 2. Find internal links from homepage HTML
  const homepageHtmlRes = await fetch(baseUrl, {
    headers: { "User-Agent": "SeaGeo-Bot/1.0" },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  const homepageHtml = homepageHtmlRes ? await homepageHtmlRes.text() : "";
  const internalLinks = extractInternalLinks(homepageHtml, baseUrl);

  // 3. Fetch internal pages in parallel (max 7)
  const internalPages = await Promise.all(
    internalLinks.map((link) => fetchPage(link))
  );

  // 4. Build structured context
  const allPages = [homepage, ...internalPages.filter(Boolean)] as NonNullable<Awaited<ReturnType<typeof fetchPage>>>[];
  const sections: string[] = [];

  for (const page of allPages) {
    const pagePath = new URL(page.url).pathname;
    const label = pagePath === "/" ? "Homepage" : pagePath;
    const parts: string[] = [`[${label}]`];
    if (page.title) parts.push(`Titolo: ${page.title}`);
    if (page.description) parts.push(`Descrizione: ${page.description}`);
    if (page.headings.length) parts.push(`Titoli: ${page.headings.join(" | ")}`);
    if (page.text) parts.push(page.text.slice(0, 800));
    sections.push(parts.join("\n"));
  }

  console.log(`[ai-generate] crawled ${allPages.length} pages from ${baseUrl}`);
  return sections.join("\n\n");
}

function buildSystemPrompt(
  project: any,
  existingTexts: string[],
  count: number,
  nTofu: number,
  nMofu: number,
  websiteContext?: string,
): string {
  const lang = project.language === "it" ? "italiano" : "English";
  const competitors = (project.known_competitors ?? []).join(", ") || "non specificati";

  const existingBlock = existingTexts.length > 0
    ? `\nQuery già presenti nel progetto (NON duplicarle):\n${existingTexts.map((t: string) => `- ${t}`).join("\n")}\n`
    : "";

  const websiteBlock = websiteContext
    ? `\n--- CONTENUTO SITO WEB (${project.website_url}) ---\n${websiteContext}\n--- FINE CONTENUTO SITO ---\n\nUsa le informazioni estratte dal sito per capire cosa offre il brand, i suoi prodotti/servizi, il tono di comunicazione, e i punti di forza. Genera query che riflettano i temi reali del brand.\n`
    : "";

  return `Sei un esperto di AI Search Optimization. Il tuo compito è generare query realistiche che utenti reali farebbero a ChatGPT, Gemini o Perplexity quando cercano informazioni nel settore di ${project.target_brand}.

Contesto brand:
- Brand: ${project.target_brand}
- Nome progetto: ${project.name}
- Settore: ${project.sector ?? "non specificato"}
- Tipo brand: ${project.brand_type ?? "non specificato"}
- Mercato: ${project.country ?? "Italia"} / lingua ${lang}
- Sito: ${project.website_url ?? "non specificato"}
- Competitor noti: ${competitors}
- Contesto aggiuntivo: ${project.market_context ?? "nessuno"}
${websiteBlock}${existingBlock}
Genera esattamente ${count} query uniche e realistiche in ${lang}.

DUE TIPOLOGIE DI QUERY:

${nTofu} TOFU — Domande di scoperta generiche sul settore.
L'utente sta esplorando il settore, non conosce ancora i brand.
NON menzionare "${project.target_brand}" né alcun competitor.
Esempi di angolazione: panoramica di mercato, tendenze, criteri di scelta, problemi comuni del settore, cosa cercare in un fornitore/prodotto.

${nMofu} MOFU — Domande su bisogni specifici che il brand risolve, MA senza mai nominare "${project.target_brand}" né alcun competitor.
L'utente descrive un problema, un'esigenza o una situazione concreta che "${project.target_brand}" potrebbe risolvere.
Lo scopo è intercettare i BISOGNI LATENTI: l'utente chiede aiuto all'AI descrivendo cosa gli serve, e noi misuriamo se l'AI risponde suggerendo "${project.target_brand}".
Queste query devono:
- Descrivere un bisogno specifico legato ai prodotti/servizi reali del brand (usa il contenuto del sito web)
- Usare il linguaggio che un potenziale cliente userebbe
- NON contenere MAI il nome del brand né dei competitor — sono completamente unbranded
- Essere abbastanza specifiche da "puntare" implicitamente verso il brand senza nominarlo
Esempi di struttura: "Cerco un [tipo servizio] che [caratteristica specifica del brand]", "Ho bisogno di [soluzione a problema che il brand risolve]", "Quale [categoria] è migliore per chi ha [esigenza specifica]?"

Regole generali:
- Ogni query deve essere semanticamente distinta dalle altre
- Usa il linguaggio naturale che un utente reale userebbe su ChatGPT o Gemini
- Adatta tono e vocabolario al settore e tipo di brand
- NESSUNA query deve contenere il nome "${project.target_brand}" — né TOFU né MOFU
- NON usare template ripetitivi — varia struttura, angolazione e formulazione
- Usa i temi, prodotti e servizi reali del brand emersi dal sito web per rendere le query MOFU specifiche e contestualizzate ai bisogni reali dei clienti
- Rispondi SOLO con un JSON array, nessun altro testo

Formato risposta:
[{"text": "...", "funnel_stage": "TOFU"}, {"text": "...", "funnel_stage": "MOFU"}]`;
}

function buildFollowUpPrompt(
  project: any,
  allExisting: string[],
  missing: number,
  nTofuMissing: number,
  nMofuMissing: number,
): string {
  const lang = project.language === "it" ? "italiano" : "English";

  return `Sei un esperto di AI Search Optimization. Devi generare ${missing} query aggiuntive per il settore di "${project.target_brand}" (settore: ${project.sector ?? "non specificato"}).

Query già generate (NON duplicarle):
${allExisting.map((t) => `- ${t}`).join("\n")}

Genera esattamente ${missing} query nuove in ${lang}:
${nTofuMissing > 0 ? `${nTofuMissing} TOFU — domande generiche di scoperta sul settore, SENZA citare alcun brand` : ""}
${nMofuMissing > 0 ? `${nMofuMissing} MOFU — domande su bisogni specifici che "${project.target_brand}" risolve, MA completamente unbranded (nessun nome brand). L'utente descrive un bisogno/problema, noi misuriamo se l'AI consiglia il brand.` : ""}

NESSUNA query deve contenere il nome "${project.target_brand}" né dei competitor.

Rispondi SOLO con un JSON array:
[{"text": "...", "funnel_stage": "TOFU"|"MOFU"}]`;
}
