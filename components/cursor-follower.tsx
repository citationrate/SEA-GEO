"use client";

import { useEffect, useRef, useState } from "react";

const CURSOR_COLOR = "#7eb89a";
const DOT_SIZE = 8;
const RING_SIZE = 36;
const LERP = 0.12;

export function CursorFollower() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Hide on touch / coarse-pointer devices
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    if (mq.matches) return;

    setVisible(true);
    document.documentElement.classList.add("custom-cursor");

    let mx = 0;
    let my = 0;
    let rx = 0;
    let ry = 0;
    let rafId: number;

    function onMouseMove(e: MouseEvent) {
      mx = e.clientX;
      my = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.left = mx + "px";
        dotRef.current.style.top = my + "px";
      }
    }

    function animRing() {
      rx += (mx - rx) * LERP;
      ry += (my - ry) * LERP;
      if (ringRef.current) {
        ringRef.current.style.left = rx + "px";
        ringRef.current.style.top = ry + "px";
      }
      rafId = requestAnimationFrame(animRing);
    }

    function onMouseLeave() {
      if (dotRef.current) dotRef.current.style.opacity = "0";
      if (ringRef.current) ringRef.current.style.opacity = "0";
    }

    function onMouseEnter() {
      if (dotRef.current) dotRef.current.style.opacity = "1";
      if (ringRef.current) ringRef.current.style.opacity = "1";
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);
    rafId = requestAnimationFrame(animRing);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      cancelAnimationFrame(rafId);
      document.documentElement.classList.remove("custom-cursor");
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Punto — segue istantaneamente */}
      <div
        ref={dotRef}
        style={{
          position: "fixed",
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: "50%",
          background: CURSOR_COLOR,
          pointerEvents: "none",
          transform: "translate(-50%, -50%)",
          zIndex: 2147483647,
          transition: "opacity 0.2s",
        }}
      />
      {/* Anello — segue con inerzia (lerp 12%) */}
      <div
        ref={ringRef}
        style={{
          position: "fixed",
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: "50%",
          border: `1px solid ${CURSOR_COLOR}`,
          background: "transparent",
          pointerEvents: "none",
          transform: "translate(-50%, -50%)",
          zIndex: 2147483646,
          transition: "opacity 0.2s",
        }}
      />
    </>
  );
}
