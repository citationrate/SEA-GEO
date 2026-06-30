import Anthropic from "@anthropic-ai/sdk";
import dns from "dns/promises";

/**
 * Shared site-analysis engine: crawl a website (homepage + key internal pages,
 * with a Jina Reader fallback for WAF-protected sites) and run a Claude Haiku
 * structured extraction to produce a {@link SiteAnalysis}.
 *
 * Extracted from app/api/projects/analyze-site/route.ts so both the manual
 * project-creation flow AND the suite seed flow (app/api/queries/seed) can
 * populate site_analysis. Auth and Haiku-quota enforcement stay in the callers.
 */

export type AnalyzeLang = "it" | "en" | "fr" | "de" | "es";

export interface SiteAnalysis {
  main_service: string;
  target_audience: string;
  value_proposition: string;
  sector_keywords: string[];
  competitor_signals: string[];
  tone: string;
  geography: string;
}

export type AnalyzeSiteResult =
  | { ok: true; analysis: SiteAnalysis }
  | { ok: false; reason: "ssrf" | "unreachable" | "parse" };

/** SSRF protection: resolve hostname and block private/reserved IPs */
async function validateUrlNotPrivate(urlString: string): Promise<void> {
  const parsed = new URL(urlString);
  const hostname = parsed.hostname;

  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    throw new Error("Blocked: metadata endpoint");
  }

  let addresses: string[];
  try {
    addresses = await dns.resolve4(hostname);
  } catch {
    try {
      addresses = await dns.resolve6(hostname);
    } catch {
      // Cannot resolve — let the fetch fail naturally
      return;
    }
  }

  try {
    const result6 = await dns.resolve6(hostname);
    addresses = [...addresses, ...result6];
  } catch { /* no IPv6, that's fine */ }

  for (const ip of addresses) {
    if (isPrivateIP(ip)) {
      throw new Error(`Blocked: private IP ${ip}`);
    }
  }
}

function isPrivateIP(ip: string): boolean {
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (/^f[cd]/i.test(ip)) return true;
  if (/^fe[89ab]/i.test(ip)) return true;

  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

/** Fetch a single page and extract text content (10s timeout) */
async function fetchPageText(pageUrl: string): Promise<{ title: string; description: string; headings: string[]; text: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AVI/1.0; +https://avi.citationrate.com)" },
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

/** Fallback: fetch page content via Jina Reader (bypasses WAFs like Cloudflare/Akamai) */
async function fetchViaJina(pageUrl: string): Promise<{ title: string; description: string; headings: string[]; text: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`https://r.jina.ai/${pageUrl}`, {
      signal: controller.signal,
      headers: { Accept: "text/plain" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const markdown = await res.text();
    const titleMatch = markdown.match(/^Title:\s*(.+)$/m);
    const title = titleMatch?.[1]?.trim() ?? "";
    const headings = Array.from(markdown.matchAll(/^#{1,2}\s+(.+)$/gm))
      .map((m) => m[1].trim())
      .filter((h) => h.length > 2 && h.length < 200)
      .slice(0, 15);
    const text = markdown
      .replace(/^(Title|URL Source|Markdown Content):.*$/gm, "")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);

    return { title, description: "", headings, text };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Crawl + analyze a website into a structured SiteAnalysis.
 * Pure engine: no auth, no quota — callers enforce those.
 */
export async function analyzeSite(rawUrl: string, language: AnalyzeLang): Promise<AnalyzeSiteResult> {
  let baseUrl = rawUrl.trim();
  if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;

  // SSRF protection: block private/reserved IPs
  try {
    await validateUrlNotPrivate(baseUrl);
  } catch (ssrfErr) {
    console.error("[site-analysis] SSRF blocked:", ssrfErr instanceof Error ? ssrfErr.message : ssrfErr);
    return { ok: false, reason: "ssrf" };
  }

  // Fetch homepage (direct fetch first, Jina Reader fallback for WAF-protected sites)
  let homepage = await fetchPageText(baseUrl);
  let usedJina = false;
  if (!homepage) {
    console.log("[site-analysis] Direct fetch failed, trying Jina Reader for:", baseUrl);
    homepage = await fetchViaJina(baseUrl);
    usedJina = true;
  }
  if (!homepage) return { ok: false, reason: "unreachable" };

  // Fetch up to 2 key internal pages (about/services) — skip if using Jina fallback
  const internalLinks: string[] = usedJina ? [] : ((homepage as any)._links ?? []);
  const internalPages = await Promise.all(internalLinks.map((link: string) => fetchPageText(link)));

  const allPages = [homepage, ...internalPages.filter(Boolean)];
  const content = allPages.map((page: any) => {
    const parts: string[] = [];
    if (page.title) parts.push(`Title: ${page.title}`);
    if (page.description) parts.push(`Description: ${page.description}`);
    if (page.headings?.length) parts.push(`Headings: ${page.headings.join(" | ")}`);
    if (page.text) parts.push(page.text.slice(0, 1500));
    return parts.join("\n");
  }).join("\n\n---\n\n");

  const langMap: Record<string, { name: string; tones: string; geos: string }> = {
    it: { name: "Italian", tones: "professionale, amichevole, lusso, economico, tecnico", geos: "locale, nazionale, internazionale" },
    en: { name: "English", tones: "professional, friendly, luxury, budget, technical", geos: "local, national, international" },
    fr: { name: "French", tones: "professionnel, amical, luxe, économique, technique", geos: "local, national, international" },
    de: { name: "German", tones: "professionell, freundlich, Luxus, günstig, technisch", geos: "lokal, national, international" },
    es: { name: "Spanish", tones: "profesional, amigable, lujo, económico, técnico", geos: "local, nacional, internacional" },
  };
  const l = langMap[language] ?? langMap.en;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `Analyze this website and extract structured information. Respond ENTIRELY in ${l.name}. Return JSON only, no other text.

Website content:
${content.slice(0, 4000)}

Extract (ALL text values MUST be in ${l.name}):
1. main_service: What is the primary service/product offered? (1-2 sentences, in ${l.name})
2. target_audience: Who are the customers? (B2B/B2C, demographics, profession, in ${l.name})
3. value_proposition: What makes this brand unique? (1-2 sentences, in ${l.name})
4. sector_keywords: 5-10 keywords that describe the sector (array of strings, in ${l.name})
5. competitor_signals: THIRD-PARTY COMPETING companies only. Follow these rules strictly:
   - First, identify the TARGET BRAND (from the domain, page titles, and site copy).
   - Then extract ONLY external companies that COMPETE with the target brand on the same market.
   - EXCLUDE: the target brand's own sub-brands, product lines, subsidiaries, owned brands, internal divisions, or brands in its own portfolio.
   - EXCLUDE: any brand presented as "our product", "by us", "part of our group", or similar.
   - If the site only showcases its own portfolio without mentioning external competitors, return [].
   WRONG examples to avoid:
   - nestle.com → MUST NOT return KitKat, Nespresso, Nescafé (those are Nestlé-owned sub-brands). Valid competitors: Mondelez, Unilever, Danone.
   - apple.com → MUST NOT return iPhone, iPad, MacBook (product lines, not competitors). Valid competitors: Samsung, Google, Microsoft.
   - unilever.com → MUST NOT return Dove, Knorr, Magnum (owned brands). Valid competitors: Procter & Gamble, Nestlé, Colgate-Palmolive.
   Output: array of company names, max 5, empty [] if uncertain or if only owned brands are found.
6. tone: One of: ${l.tones}
7. geography: One of: ${l.geos}

Return ONLY valid JSON:
{"main_service": "...", "target_audience": "...", "value_proposition": "...", "sector_keywords": [...], "competitor_signals": [...], "tone": "...", "geography": "..."}`,
    }],
  });

  const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? cleaned);
    const analysis: SiteAnalysis = {
      main_service: parsed.main_service ?? "",
      target_audience: parsed.target_audience ?? "",
      value_proposition: parsed.value_proposition ?? "",
      sector_keywords: Array.isArray(parsed.sector_keywords) ? parsed.sector_keywords : [],
      competitor_signals: Array.isArray(parsed.competitor_signals) ? parsed.competitor_signals : [],
      tone: parsed.tone ?? "professional",
      geography: parsed.geography ?? "national",
    };
    return { ok: true, analysis };
  } catch {
    return { ok: false, reason: "parse" };
  }
}
