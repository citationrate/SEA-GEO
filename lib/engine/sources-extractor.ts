export interface ExtractedSource {
  url: string;
  domain: string;
  title?: string;
  source_type: "brand_owned" | "competitor" | "media" | "review" | "social" | "ecommerce" | "wikipedia" | "other";
  context?: string;
}

/** Estrae fonti da URL citation annotations (OpenAI Responses API) */
export function extractFromAnnotations(output: any[]): ExtractedSource[] {
  const results: ExtractedSource[] = [];
  const seen = new Set<string>();
  try {
    for (const item of output || []) {
      if (item.type === "message") {
        for (const content of item.content || []) {
          for (const annotation of content.annotations || []) {
            if (annotation.type === "url_citation" && annotation.url) {
              const domain = safeDomain(annotation.url);
              if (domain && !seen.has(domain)) {
                seen.add(domain);
                results.push({
                  url: annotation.url,
                  domain,
                  title: annotation.title,
                  source_type: classifyDomain(domain),
                });
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.log("extractFromAnnotations error:", e);
  }
  return results;
}

/** Estrae fonti da Gemini grounding metadata */
export function extractFromGrounding(candidates: any[]): ExtractedSource[] {
  const results: ExtractedSource[] = [];
  const seen = new Set<string>();
  try {
    const chunks = candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    for (const chunk of chunks) {
      if (chunk.web?.uri) {
        const domain = safeDomain(chunk.web.uri);
        if (domain && !seen.has(domain)) {
          seen.add(domain);
          results.push({
            url: chunk.web.uri,
            domain,
            title: chunk.web.title,
            source_type: classifyDomain(domain),
          });
        }
      }
    }
  } catch (e) {
    console.log("extractFromGrounding error:", e);
  }
  return results;
}

/** Estrae domini e URL dal testo puro (fallback universale) */
export function extractFromText(text: string): ExtractedSource[] {
  const results: ExtractedSource[] = [];
  const seen = new Set<string>();
  const blacklist = new Set([
    "next.js", "node.js", "react.js", "type.ts", "index.js",
    "package.json", "vercel.app",
  ]);

  // URL completi
  const urlMatches = text.match(/https?:\/\/[^\s)\"'<>,\]]+/g) || [];
  for (const url of urlMatches) {
    const domain = safeDomain(url);
    if (domain && !seen.has(domain) && !blacklist.has(domain)) {
      seen.add(domain);
      results.push({
        url,
        domain,
        source_type: classifyDomain(domain),
        context: "URL citato nella risposta",
      });
    }
  }

  // Domini senza http
  const domainMatches =
    text.match(/\b[a-zA-Z0-9][a-zA-Z0-9-]*\.(com|it|io|net|org|co\.uk|fr|de|es|ai|info|biz)\b/g) || [];
  for (const d of domainMatches) {
    const clean = d.replace(/^www\./, "").toLowerCase();
    if (!seen.has(clean) && !blacklist.has(clean) && clean.length > 4) {
      seen.add(clean);
      results.push({
        url: "https://" + clean,
        domain: clean,
        source_type: classifyDomain(clean),
        context: "dominio menzionato",
      });
    }
  }

  return results;
}

/** Merge e deduplica fonti da più sorgenti (ordine = priorità) */
export function mergeSources(...sourceLists: ExtractedSource[][]): ExtractedSource[] {
  const seen = new Set<string>();
  const results: ExtractedSource[] = [];
  for (const list of sourceLists) {
    for (const source of list) {
      if (source.domain && !seen.has(source.domain)) {
        seen.add(source.domain);
        results.push(source);
      }
    }
  }
  return results;
}

function safeDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function classifyDomain(domain: string): ExtractedSource["source_type"] {
  if (/amazon|ebay|zalando|shopify|etsy|shop\./.test(domain)) return "ecommerce";
  if (/wikipedia\.org/.test(domain)) return "wikipedia";
  if (/instagram|facebook|twitter|tiktok|youtube|linkedin/.test(domain)) return "social";
  if (/trustpilot|tripadvisor|yelp|recensioni/.test(domain)) return "review";
  return "other";
}
