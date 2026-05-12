"use client";

import { useEffect, useRef } from "react";

const INTERNAL_EMAILS = [
  "@citationrate.com",
  "tutorial@",
  "metatest-funnel@",
  "+test",
  "+pixel",
  "admin@",
  "demo@",
];

// Max 10 minutes per session to keep data manageable
const MAX_DURATION_MS = 10 * 60 * 1000;

export function SessionRecorder({ userId, email }: { userId: string; email?: string }) {
  const stopFnRef = useRef<(() => void) | null>(null);
  const eventsRef = useRef<any[]>([]);
  const startTimeRef = useRef<number>(0);
  const savedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRef = useRef(false);

  const isInternal = email && INTERNAL_EMAILS.some((p) => email.includes(p));

  function saveSession() {
    if (savedRef.current || eventsRef.current.length === 0) return;
    savedRef.current = true;

    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const payload = JSON.stringify({
      user_id: userId,
      events: eventsRef.current,
      page_url: "full-session",
      started_at: new Date(startTimeRef.current).toISOString(),
      duration_seconds: durationSeconds,
    });

    try {
      const sent = navigator.sendBeacon(
        "/api/session-recording",
        new Blob([payload], { type: "application/json" })
      );
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
    if (isInternal || initRef.current) return;
    initRef.current = true;

    let mounted = true;

    async function startRecording() {
      try {
        const rrwebModule = await import("rrweb");
        const record = rrwebModule.record;

        eventsRef.current = [];
        startTimeRef.current = Date.now();
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
          maskInputOptions: { password: true },
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

    // Save ONLY when the page is actually closing (not tab switch)
    function handleBeforeUnload() {
      if (stopFnRef.current) stopFnRef.current();
      saveSession();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      mounted = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (stopFnRef.current) stopFnRef.current();
      saveSession();
    };
  }, [userId, isInternal]);

  return null;
}
