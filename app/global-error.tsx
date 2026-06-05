"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0c1410",
          color: "#f1efe7",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px", color: "#8dc5a7" }}>
            Qualcosa è andato storto
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.5, margin: "0 0 24px", color: "#b9c2bb" }}>
            Si è verificato un errore imprevisto. Riprova: di solito basta.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#3f7d5b",
              color: "#0c1410",
              border: "none",
              borderRadius: 4,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}
