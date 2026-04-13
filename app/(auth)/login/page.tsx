"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    // Brief delay to show the redirect message before navigating
    const timer = setTimeout(() => {
      window.location.href = "https://suite.citationrate.com";
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-muted-foreground">
          Redirecting to CitationRate login...
        </p>
      </div>
    </div>
  );
}
