-- Track AI-consulted vs text-mentioned source origin (Perplexity, Claude, Gemini)
ALTER TABLE sources
ADD COLUMN IF NOT EXISTS source_origin text DEFAULT 'text_mention';
-- Values: 'ai_consulted' (URL the AI actually fetched) | 'text_mention' (URL found in response text)

-- Track whether brand domain appears in AI-consulted citation URLs
ALTER TABLE response_analysis
ADD COLUMN IF NOT EXISTS brand_in_citations boolean DEFAULT false;

-- Save raw citation URLs per prompt for future analysis (avoids blind spot)
ALTER TABLE prompts_executed
ADD COLUMN IF NOT EXISTS citation_urls text[] DEFAULT '{}';
