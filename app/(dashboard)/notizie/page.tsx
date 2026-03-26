import { AiNewsPanel } from "@/components/ai-news-panel";
import { T } from "@/components/translated-label";

export const metadata = { title: "AI News" };

export default function NotiziePage() {
  return (
    <div className="max-w-[900px] space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl text-foreground" style={{ fontWeight: 300 }}>
          <T k="aiNews.title" />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          <T k="aiNews.subtitle" />
        </p>
      </div>

      <AiNewsPanel />
    </div>
  );
}
