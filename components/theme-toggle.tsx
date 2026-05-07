"use client";

import { useState, useEffect } from "react";
import { writeThemeCookie } from "@/lib/preferences-cookie";

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
    const value = next ? "light" : "dark";
    try { localStorage.setItem("seageo-theme", value); } catch {}
    writeThemeCookie(value);
  }

  if (!mounted) return <div className="w-11 h-6" />;

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground select-none">
        {light ? "LIGHT" : "DARK"}
      </span>
      <button
        onClick={toggle}
        className="relative w-11 h-6 rounded-full transition-colors duration-200"
        style={{ backgroundColor: light ? "var(--primary)" : "rgba(255,255,255,0.15)" }}
        aria-label="Toggle theme"
      >
        <div
          className="absolute w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ top: "50%", transform: light ? "translate(22px, -50%)" : "translate(2px, -50%)" }}
        />
      </button>
    </div>
  );
}
