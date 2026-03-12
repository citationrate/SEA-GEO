"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, Tag, TrendingUp } from "lucide-react";

interface TopicItem {
  name: string;
  count: number;
  relevanceScore: number;
  funnelBreakdown: { tofu: number; mofu: number; bofu: number };
}

interface CategoryGroup {
  name: string;
  topics: string[];
}

interface Props {
  topics: TopicItem[];
  brand: string;
}

export function TopicsClient({ topics, brand }: Props) {
  const [categories, setCategories] = useState<CategoryGroup[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const topicMap = new Map(topics.map((t) => [t.name, t]));

  useEffect(() => {
    if (topics.length === 0) return;
    categorize();
  }, [topics.length]);

  async function categorize() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/topics/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: topics.map((t) => ({ name: t.name, count: t.count })),
          brand,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore");
      }
      const data = await res.json();
      setCategories(data.categories ?? []);
      setSummary(data.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
      // Fallback: show all topics in a single group
      setCategories([{ name: "Tutti i topic", topics: topics.map((t) => t.name) }]);
    } finally {
      setLoading(false);
    }
  }

  const maxCount = topics.length > 0 ? Math.max(...topics.map((t) => t.count)) : 1;
  const maxRelevance = topics.length > 0 ? Math.max(...topics.map((t) => t.relevanceScore)) : 1;

  return (
    <div className="space-y-6">
      {/* AI Summary */}
      {loading && (
        <div className="card p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Categorizzazione topic in corso...
        </div>
      )}

      {summary && !loading && (
        <div className="card p-4 flex items-start gap-2.5 border-primary/20">
          <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-foreground leading-relaxed">{summary}</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Grouped categories */}
      {categories && !loading && categories.map((cat) => {
        const catTopics = cat.topics
          .map((name) => topicMap.get(name))
          .filter(Boolean) as TopicItem[];

        // Sort by relevance within category
        catTopics.sort((a, b) => b.relevanceScore - a.relevanceScore || b.count - a.count);

        if (catTopics.length === 0) return null;

        return (
          <div key={cat.name} className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                {cat.name}
              </h2>
              <span className="text-xs text-muted-foreground">{catTopics.length} topic</span>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catTopics.map((topic) => (
                <TopicCard key={topic.name} topic={topic} maxCount={maxCount} maxRelevance={maxRelevance} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Fallback while loading: show flat list */}
      {!categories && !loading && topics.length > 0 && (
        <div className="card p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topics.map((topic) => (
              <TopicCard key={topic.name} topic={topic} maxCount={maxCount} maxRelevance={maxRelevance} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TopicCard({ topic, maxCount, maxRelevance }: { topic: TopicItem; maxCount: number; maxRelevance: number }) {
  const barWidth = (topic.count / maxCount) * 100;
  const { tofu, mofu, bofu } = topic.funnelBreakdown;
  const total = tofu + mofu + bofu;

  return (
    <div className="p-3 rounded-[2px] border border-border bg-surface hover:border-primary/30 transition-colors space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground truncate">{topic.name}</span>
        <span className="badge badge-muted text-[12px] shrink-0 ml-2">{topic.count}x</span>
      </div>

      {/* Count bar */}
      <div className="h-1.5 rounded-[2px] bg-muted overflow-hidden">
        <div
          className="h-full rounded-[2px] bg-primary transition-all duration-500"
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Funnel breakdown */}
      {total > 0 && (
        <div className="flex items-center gap-2 text-[12px]">
          {mofu > 0 && (
            <span className="flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5 text-success" />
              <span className="text-success font-medium">MOFU {mofu}</span>
            </span>
          )}
          {tofu > 0 && (
            <span className="text-muted-foreground">TOFU {tofu}</span>
          )}
          {bofu > 0 && (
            <span className="text-muted-foreground">BOFU {bofu}</span>
          )}
        </div>
      )}

      {/* Relevance indicator */}
      <div className="flex items-center gap-1">
        <span className="text-[12px] text-muted-foreground">Rilevanza</span>
        <div className="flex gap-px">
          {Array.from({ length: 5 }).map((_, i) => {
            const filled = Math.ceil((topic.relevanceScore / Math.max(maxRelevance, 1)) * 5);
            return (
              <span
                key={i}
                className={`w-1 h-2.5 rounded-[1px] ${i < filled ? "bg-primary" : "bg-border"}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
