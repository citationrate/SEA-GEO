export type SourceOrigin = "ai_consulted" | "text_mention";

export interface ExtractedSource {
  url: string;
  domain: string;
  title?: string;
  source_type: "brand_owned" | "competitor" | "media" | "review" | "social" | "ecommerce" | "wikipedia" | "other";
  source_origin?: SourceOrigin;
  context?: string;
  associated_brand?: string;
}

/** Estrae fonti da URL citation annotations (OpenAI Responses API) */
export function extractFromAnnotations(output: any[], brandDomain?: string): ExtractedSource[] {
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
                  source_type: classifyDomain(domain, brandDomain),
                  source_origin: "text_mention",
                });
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("extractFromAnnotations error:", e);
  }
  return results;
}

/** Estrae fonti da Anthropic web_search_tool_result blocks */
export function extractFromAnthropicSearch(contentBlocks: any[], brandDomain?: string): ExtractedSource[] {
  const results: ExtractedSource[] = [];
  const seen = new Set<string>();
  try {
    for (const block of contentBlocks || []) {
      if (block.type === "web_search_tool_result") {
        for (const result of block.content || []) {
          if (result.type === "web_search_result" && result.url) {
            const domain = safeDomain(result.url);
            if (domain && !seen.has(domain)) {
              seen.add(domain);
              results.push({
                url: result.url,
                domain,
                title: result.title,
                source_type: classifyDomain(domain, brandDomain),
                source_origin: "ai_consulted",
                context: "Anthropic web search",
              });
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("extractFromAnthropicSearch error:", e);
  }
  return results;
}

/** Estrae fonti da Gemini grounding metadata */
export function extractFromGrounding(candidates: any[], brandDomain?: string): ExtractedSource[] {
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
            source_type: classifyDomain(domain, brandDomain),
            source_origin: "ai_consulted",
          });
        }
      }
    }
  } catch (e) {
    console.error("extractFromGrounding error:", e);
  }
  return results;
}

const BLACKLIST = new Set([
  "next.js", "node.js", "react.js", "type.ts", "index.js",
  "package.json", "vercel.app", "example.com", "e.g",
]);

/**
 * Estrae fonti organiche dal testo della risposta AI.
 * Cattura: markdown links, plain URLs, footnotes, inline domain references.
 */
export function extractFromText(text: string, brandDomain?: string): ExtractedSource[] {
  const results: ExtractedSource[] = [];
  const seen = new Set<string>();

  function addSource(url: string, title?: string, context?: string) {
    const domain = safeDomain(url) ?? extractBareDomain(url);
    if (!domain || seen.has(domain) || BLACKLIST.has(domain) || domain.length < 4) return;
    seen.add(domain);
    results.push({
      url: url.startsWith("http") ? url : "https://" + url,
      domain,
      title: title || domainToTitle(domain),
      source_type: classifyDomain(domain, brandDomain),
      source_origin: "text_mention",
      context: context || "fonte citata nella risposta",
    });
  }

  // 1. Markdown links: [title](url)
  const mdLinkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdLinkRe.exec(text)) !== null) {
    addSource(m[2], m[1], "markdown link");
  }

  // 2. Plain URLs: https://... or http://...
  const urlRe = /(?<!\()https?:\/\/[^\s)\"'<>,\]]+/g;
  while ((m = urlRe.exec(text)) !== null) {
    addSource(m[0], undefined, "URL citato nella risposta");
  }

  // 3. Footnote patterns: [1] https://... or [1]: https://... or ¹ https://...
  const footnoteRe = /(?:\[\d+\][\s:]*|[¹²³⁴⁵⁶⁷⁸⁹⁰]+[\s:]*)(https?:\/\/[^\s)\"'<>,]+)/g;
  while ((m = footnoteRe.exec(text)) !== null) {
    addSource(m[1], undefined, "footnote");
  }

  // 4. Inline domain references in brackets: [domain.com] or (domain.com)
  const bracketDomainRe = /[\[(]((?:www\.)?[a-zA-Z0-9][a-zA-Z0-9-]+\.(?:com|it|io|net|org|co\.uk|fr|de|es|ai|info|biz|eu|ch|at|nl|be|pt|se|no|dk|fi|pl|cz|ru|jp|cn|au|ca|us|uk|me)(?:\/[^\s)\]]*)?)[)\]]/g;
  while ((m = bracketDomainRe.exec(text)) !== null) {
    const raw = m[1].replace(/^www\./, "");
    addSource(raw, undefined, "dominio inline");
  }

  // 5. Bare domains in text (not inside URLs already captured)
  const bareDomainRe = /\b((?:www\.)?[a-zA-Z0-9][a-zA-Z0-9-]+\.(?:com|it|io|net|org|co\.uk|fr|de|es|ai|info|biz|eu|ch|at|nl|be|pt|se|no|dk|fi|pl|cz|me))\b/g;
  while ((m = bareDomainRe.exec(text)) !== null) {
    const clean = m[1].replace(/^www\./, "").toLowerCase();
    addSource(clean, undefined, "dominio menzionato");
  }

  return results;
}

/** Merge e deduplica fonti per domain, mantiene l'URL più specifico (path più lungo) e il title migliore.
 *  Prefers 'ai_consulted' over 'text_mention' when same domain appears from both origins. */
export function mergeSources(...sourceLists: ExtractedSource[][]): ExtractedSource[] {
  const seen = new Map<string, ExtractedSource>();
  for (const list of sourceLists) {
    for (const source of list) {
      if (!source.domain) continue;
      const existing = seen.get(source.domain);
      if (!existing) {
        seen.set(source.domain, source);
      } else {
        // Keep longer URL (more specific path)
        if (source.url.length > existing.url.length) {
          existing.url = source.url;
        }
        // Keep title if existing doesn't have one
        if (!existing.title && source.title) {
          existing.title = source.title;
        }
        // Keep associated_brand
        if (!existing.associated_brand && source.associated_brand) {
          existing.associated_brand = source.associated_brand;
        }
        // Promote to ai_consulted if either source has it
        if (source.source_origin === "ai_consulted") {
          existing.source_origin = "ai_consulted";
        }
      }
    }
  }
  return Array.from(seen.values());
}

function safeDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function extractBareDomain(input: string): string | null {
  const clean = input.replace(/^www\./, "").toLowerCase().split("/")[0];
  if (/^[a-z0-9][a-z0-9-]*\.[a-z]{2,}$/.test(clean)) return clean;
  return null;
}

function domainToTitle(domain: string): string {
  // "gqitalia.it" → "GQ Italia", "trustpilot.com" → "Trustpilot"
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Classify domain source type — exported for use in provider-specific extractors */
export function classifyDomainForPerplexity(domain: string, brandDomain?: string): ExtractedSource["source_type"] {
  return classifyDomain(domain, brandDomain);
}

function classifyDomain(domain: string, brandDomain?: string): ExtractedSource["source_type"] {
  if (brandDomain && domain.includes(brandDomain.replace(/^www\./, "").toLowerCase())) return "brand_owned";
  if (/amazon|ebay|zalando|shopify|etsy|shop\.|aliexpress/.test(domain)) return "ecommerce";
  if (/wikipedia\.org/.test(domain)) return "wikipedia";
  if (/instagram|facebook|twitter|x\.com|tiktok|youtube|linkedin|reddit|threads/.test(domain)) return "social";
  if (/trustpilot|tripadvisor|yelp|recensioni|glassdoor|g2\.com/.test(domain)) return "review";
  return "media";
}
