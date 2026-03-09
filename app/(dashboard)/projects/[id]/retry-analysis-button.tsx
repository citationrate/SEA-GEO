"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, Loader2 } from "lucide-react";

export function RetryAnalysisButton({
  projectId,
  modelsUsed,
  runCount,
}: {
  projectId: string;
  modelsUsed: string[];
  runCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function retry() {
    setLoading(true);
    try {
      const res = await fetch("/api/analysis/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          models_used: modelsUsed,
          run_count: runCount,
          browsing: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Retry failed:", data.error);
      }
      router.refresh();
    } catch (err) {
      console.error("Retry error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={retry}
      disabled={loading}
      className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RotateCw className="w-4 h-4" />
      )}
      {loading ? "Avvio..." : "Riprova"}
    </button>
  );
}
