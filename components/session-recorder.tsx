"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Internal/test accounts — don't record
const INTERNAL_EMAILS = [
  "@citationrate.com",
  "tutorial@",
  "metatest-funnel@",
  "+test",
  "+pixel",
  "admin@",
  "demo@",
];

// Max recording duration (5 minutes) to keep data size manageable
const MAX_DURATION_MS = 5 * 60 * 1000;
// Flush interval — save recording every 60 seconds
const FLUSH_INTERVAL_MS = 60 * 1000;

export function SessionRecorder({ userId, email }: { userId: string; email?: string }) {
  const pathname = usePathname();
  const stopFnRef = useRef<(() => void) | null>(null);
  const eventsRef = useRef<any[]>([]);
  const startTimeRef = useRef<number>(0);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startPageRef = useRef<string>("");

  const isInternal = email && INTERNAL_EMAILS.some((p) => email.includes(p));

  async function flushEvents() {
    const events = eventsRef.current;
    if (events.length === 0) return;

    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      await fetch("/api/session-recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          events,
          page_url: startPageRef.current,
          started_at: new Date(startTimeRef.current).toISOString(),
          duration_seconds: durationSeconds,
        }),
      });
    } catch (e) {
      console.warn("[session-recorder] flush failed:", e);
    }

    // Reset for next batch
    eventsRef.current = [];
    startTimeRef.current = Date.now();
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

        const stop = record({
          emit(event) {
            if (!mounted) return;
            eventsRef.current.push(event);

            // Auto-stop after max duration
            if (Date.now() - startTimeRef.current > MAX_DURATION_MS) {
              flushEvents();
              // Restart with fresh session
              eventsRef.current = [];
              startTimeRef.current = Date.now();
              startPageRef.current = window.location.pathname;
            }
          },
          // Mask sensitive inputs
          maskAllInputs: true,
          // Sample mouse movements to reduce data
          sampling: {
            mousemove: true,
            mouseInteraction: true,
            scroll: 150,
            input: "last",
          },
          // Don't record passwords
          maskInputOptions: {
            password: true,
          },
        });

        if (stop) stopFnRef.current = stop;

        // Periodic flush
        flushTimerRef.current = setInterval(() => {
          if (eventsRef.current.length > 0) {
            flushEvents();
          }
        }, FLUSH_INTERVAL_MS);
      } catch (e) {
        console.warn("[session-recorder] rrweb init failed:", e);
      }
    }

    startRecording();

    return () => {
      mounted = false;
      if (stopFnRef.current) stopFnRef.current();
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      // Final flush on unmount
      if (eventsRef.current.length > 0) {
        flushEvents();
      }
    };
  }, [userId, isInternal]);

  // Track page changes in the recording
  useEffect(() => {
    if (isInternal) return;
    startPageRef.current = pathname;
  }, [pathname, isInternal]);

  return null;
}
