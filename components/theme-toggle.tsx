"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try { localStorage.setItem("seageo-theme", next ? "light" : "dark"); } catch {}
  }

  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={toggle}
      className="w-8 h-8 flex items-center justify-center rounded-[2px] border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
      title={light ? "Passa al tema scuro" : "Passa al tema chiaro"}
    >
      {light ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  );
}
