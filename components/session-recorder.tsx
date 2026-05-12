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

// Flush every 30 seconds — appends to same session row
const FLUSH_INTERVAL_MS = 30 * 1000;
// Max 10 minutes
const MAX_DURATION_MS = 10 * 60 * 1000;

export function SessionRecorder({ userId, email }: { userId: string; email?: string }) {
  const stopFnRef = useRef<(() => void) | null>(null);
  const eventsRef = useRef<any[]>([]);
  const pendingRef = useRef<any[]>([]);
  const startTimeRef = useRef<number>(0);
  const sessionIdRef = useRef<string>("");
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initRef = useRef(false);

  const isInternal = email && INTERNAL_EMAILS.some((p) => email.includes(p));

  async function flush() {
    if (pendingRef.current.length === 0) return;

    const events = [...pendingRef.current];
    pendingRef.current = [];
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      if (!sessionIdRef.current) {
        // First flush — create session
        const res = await fetch("/api/session-recording", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            events,
            page_url: window.location.pathname,
          }),
        });
        const data = await res.json();
        if (data.id) sessionIdRef.current = data.id;
      } else {
        // Subsequent flushes — append to existing session
        await fetch("/api/session-recording", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionIdRef.current,
            events,
            duration_seconds: durationSeconds,
          }),
        });
      }
    } catch (e) {
      // Put events back if flush failed
      pendingRef.current = [...events, ...pendingRef.current];
      console.warn("[session-recorder] flush failed:", e);
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

        startTimeRef.current = Date.now();
        pendingRef.current = [];
        sessionIdRef.current = "";

        const stop = record({
          emit(event) {
            if (!mounted) return;
            eventsRef.current.push(event);
            pendingRef.current.push(event);
          },
          maskAllInputs: false,
          sampling: {
            mousemove: true,
            mouseInteraction: true,
            scroll: 150,
            input: "last",
          },
          maskInputOptions: { password: true },
        });

        if (stop) stopFnRef.current = stop;

        // Periodic flush — appends to same session
        flushTimerRef.current = setInterval(() => {
          flush();
          // Stop after max duration
          if (Date.now() - startTimeRef.current > MAX_DURATION_MS) {
            if (stopFnRef.current) stopFnRef.current();
            if (flushTimerRef.current) clearInterval(flushTimerRef.current);
          }
        }, FLUSH_INTERVAL_MS);
      } catch (e) {
        console.warn("[session-recorder] rrweb init failed:", e);
      }
    }

    startRecording();

    // Final flush on page close
    function handleBeforeUnload() {
      if (pendingRef.current.length > 0 && sessionIdRef.current) {
        const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
        navigator.sendBeacon(
          "/api/session-recording",
          new Blob([JSON.stringify({
            session_id: sessionIdRef.current,
            events: pendingRef.current,
            duration_seconds: durationSeconds,
            _method: "PUT",
          })], { type: "application/json" })
        );
      } else if (pendingRef.current.length > 0) {
        navigator.sendBeacon(
          "/api/session-recording",
          new Blob([JSON.stringify({
            user_id: userId,
            events: pendingRef.current,
            page_url: window.location.pathname,
          })], { type: "application/json" })
        );
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      mounted = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (stopFnRef.current) stopFnRef.current();
      flush();
    };
  }, [userId, isInternal]);

  return null;
}
