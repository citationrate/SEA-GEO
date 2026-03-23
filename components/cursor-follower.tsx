"use client";

import { useEffect, useRef, useState } from "react";

export function CursorFollower() {
  const innerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    // Skip on touch devices
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) return;

    setVisible(true);

    let mouseX = 0;
    let mouseY = 0;
    let outerX = 0;
    let outerY = 0;
    let rafId: number;

    function onMouseMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (innerRef.current) {
        innerRef.current.style.transform = `translate(${mouseX - 4}px, ${mouseY - 4}px)`;
      }
    }

    function animateOuter() {
      outerX += (mouseX - outerX) * 0.12;
      outerY += (mouseY - outerY) * 0.12;

      if (outerRef.current) {
        outerRef.current.style.transform = `translate(${outerX - 16}px, ${outerY - 16}px)`;
      }

      rafId = requestAnimationFrame(animateOuter);
    }

    function onMouseLeave() {
      if (innerRef.current) innerRef.current.style.opacity = "0";
      if (outerRef.current) outerRef.current.style.opacity = "0";
    }

    function onMouseEnter() {
      if (innerRef.current) innerRef.current.style.opacity = "1";
      if (outerRef.current) outerRef.current.style.opacity = "1";
    }

    // Detect hover on interactive elements
    function onMouseOver(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, [role='button'], input, textarea, select, label[for], .cursor-pointer")) {
        setHovering(true);
      }
    }

    function onMouseOut(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, [role='button'], input, textarea, select, label[for], .cursor-pointer")) {
        setHovering(false);
      }
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);
    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);
    rafId = requestAnimationFrame(animateOuter);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
      cancelAnimationFrame(rafId);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      <div
        ref={innerRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: hovering ? 12 : 8,
          height: hovering ? 12 : 8,
          background: "#4ade80",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 99999,
          transition: "width 0.2s, height 0.2s, opacity 0.2s",
          marginLeft: hovering ? -2 : 0,
          marginTop: hovering ? -2 : 0,
        }}
      />
      <div
        ref={outerRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: hovering ? 48 : 32,
          height: hovering ? 48 : 32,
          border: `1.5px solid rgba(74, 222, 128, ${hovering ? 0.6 : 0.4})`,
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 99998,
          transition: "width 0.2s, height 0.2s, border-color 0.2s",
          marginLeft: hovering ? -8 : 0,
          marginTop: hovering ? -8 : 0,
        }}
      />
    </>
  );
}
