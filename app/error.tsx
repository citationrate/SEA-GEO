"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <span className="text-2xl">!</span>
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="font-display text-xl font-bold text-foreground">
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Please try again or go back to the dashboard.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-[2px] border border-border text-sm text-foreground hover:bg-surface-2 transition-colors"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="px-4 py-2 rounded-[2px] bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
