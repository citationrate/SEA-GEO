"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const INTERNAL_EMAILS = [
  "@citationrate.com",
  "tutorial@",
  "metatest-funnel@",
  "+test",
  "+pixel",
  "admin@",
  "demo@",
];

// Save one complete session per page visit (max 5 minutes)
const MAX_DURATION_MS = 5 * 60 * 1000;

export function SessionRecorder({ userId, email }: { userId: string; email?: string }) {
  const pathname = usePathname();
  const stopFnRef = useRef<(() => void) | null>(null);
  const eventsRef = useRef<any[]>([]);
  const startTimeRef = useRef<number>(0);
  const startPageRef = useRef<string>("");
  const savedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isInternal = email && INTERNAL_EMAILS.some((p) => email.includes(p));

  function saveSession() {
    if (savedRef.current || eventsRef.current.length === 0) return;
    savedRef.current = true;

    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    // Use sendBeacon for reliability on page unload, fall back to fetch
    const payload = JSON.stringify({
      user_id: userId,
      events: eventsRef.current,
      page_url: startPageRef.current,
      started_at: new Date(startTimeRef.current).toISOString(),
      duration_seconds: durationSeconds,
    });

    try {
      const sent = navigator.sendBeacon("/api/session-recording", new Blob([payload], { type: "application/json" }));
      if (!sent) {
        fetch("/api/session-recording", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      fetch("/api/session-recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }

  useEffect(() => {
    if (isInternal) return;

    let mounted = true;

    async function startRecording() {
      try {
        const rrwebModule = await import("rrweb");
        const record = rrwebModule.record;

        eventsRef.current = [];
        startTimeRef.current = Date.now();
        startPageRef.current = window.location.pathname;
        savedRef.current = false;

        const stop = record({
          emit(event) {
            if (!mounted) return;
            eventsRef.current.push(event);
          },
          maskAllInputs: true,
          sampling: {
            mousemove: true,
            mouseInteraction: true,
            scroll: 150,
            input: "last",
          },
          maskInputOptions: {
            password: true,
          },
        });

        if (stop) stopFnRef.current = stop;

        // Auto-save after max duration
        timerRef.current = setTimeout(() => {
          if (stopFnRef.current) stopFnRef.current();
          saveSession();
        }, MAX_DURATION_MS);
      } catch (e) {
        console.warn("[session-recorder] rrweb init failed:", e);
      }
    }

    startRecording();

    // Save on page hide (tab close, navigate away)
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        if (stopFnRef.current) stopFnRef.current();
        saveSession();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (stopFnRef.current) stopFnRef.current();
      saveSession();
    };
  }, [userId, isInternal, pathname]);

  return null;
}
