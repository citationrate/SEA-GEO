"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function UnsubscribeContent() {
  const params = useSearchParams();
  const status = params.get("status");

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Syne, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: "#fafaf9",
      padding: "24px",
    }}>
      <div style={{
        maxWidth: "480px",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "2px",
        padding: "48px 36px",
        textAlign: "center",
      }}>
        {status === "ok" ? (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#10003;</div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#0d1014", marginBottom: "12px" }}>
              Disiscrizione completata
            </h1>
            <p style={{ fontSize: "15px", color: "#525860", lineHeight: 1.6 }}>
              Non riceverai più email promozionali da CitationRate.
              Continuerai a ricevere le email transazionali legate al tuo account.
            </p>
            <p style={{ fontSize: "13px", color: "#8a8f96", marginTop: "24px" }}>
              Hai cambiato idea?{" "}
              <a href="https://suite.citationrate.com/impostazioni" style={{ color: "#5ba4cf" }}>
                Puoi riattivare le comunicazioni dalle impostazioni
              </a>
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#0d1014", marginBottom: "12px" }}>
              Link non valido
            </h1>
            <p style={{ fontSize: "15px", color: "#525860", lineHeight: 1.6 }}>
              Questo link di disiscrizione non è valido o è già stato utilizzato.
              Per disiscriverti, contattaci a{" "}
              <a href="mailto:citationrate@gmail.com" style={{ color: "#5ba4cf" }}>
                citationrate@gmail.com
              </a>
            </p>
          </>
        )}
        <div style={{ marginTop: "32px", paddingTop: "20px", borderTop: "1px solid #e8e8e8", fontSize: "11px", color: "#8a8f96" }}>
          CitationRate — AI Visibility Platform
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeContent />
    </Suspense>
  );
}
