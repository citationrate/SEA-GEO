import { ArrowRight } from "lucide-react";
import { TranslatedLabel } from "./run-i18n";

// Deep-links to the CitationRate suite audit/new page with brand + url
// pre-filled (the suite already reads `brand` and `urls` from searchParams).
// Shared cookie .citationrate.com keeps the user signed-in across domains.
const SUITE_URL = "https://suite.citationrate.com";

export function LowScoreBridge({
  brand,
  websiteUrl,
  score,
}: {
  brand: string;
  websiteUrl: string;
  score: number;
}) {
  const qs = new URLSearchParams();
  if (brand) qs.set("brand", brand);
  if (websiteUrl) qs.set("urls", websiteUrl);
  qs.set("source", "avi-low-score");
  const href = `${SUITE_URL}/audit/new?${qs.toString()}`;

  return (
    <div className="card p-4 border-amber-500/40 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground mb-0.5">
          <TranslatedLabel tkey="runDetail.lowScoreBannerTitle" />
          <span className="text-amber-600 ml-2 font-mono text-xs">
            AVI {Math.round(score)}/100
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          <TranslatedLabel tkey="runDetail.lowScoreBannerBody" />
        </p>
      </div>
      <a
        href={href}
        className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium px-4 py-2 rounded-[2px] border border-amber-500/60 text-amber-600 hover:bg-amber-500/10 transition-colors shrink-0"
      >
        <TranslatedLabel tkey="runDetail.lowScoreBannerCta" />
        <ArrowRight className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
