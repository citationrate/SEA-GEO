"use client";

import { useState, useEffect } from "react";
import { Share2, Link2, X, Loader2, Check } from "lucide-react";

export function ShareButton({ runId, initialToken }: { runId: string; initialToken?: string | null }) {
  const [token, setToken] = useState(initialToken ?? null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const shareUrl = token && origin ? `${origin}/share/${token}` : null;

  async function handleShare() {
    if (token) {
      setShowModal(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${runId}/share`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setShowModal(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${runId}/share`, { method: "DELETE" });
      if (res.ok) {
        setToken(null);
        setShowModal(false);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <button
        onClick={handleShare}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-[2px] border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
        Condividi
      </button>

      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#111416] border border-[rgba(255,255,255,0.1)] rounded-[2px] p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-foreground">Condividi Report</h3>
                <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Chiunque abbia il link potr&agrave; visualizzare il report senza effettuare login.
              </p>
              {shareUrl && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted/30 rounded-[2px] px-3 py-2 text-sm font-mono text-foreground truncate">
                    {shareUrl}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-[2px] text-sm font-medium hover:bg-primary/80 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                    {copied ? "Copiato" : "Copia"}
                  </button>
                </div>
              )}
              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={handleRevoke}
                  disabled={loading}
                  className="text-sm text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
                >
                  {loading ? "Revocando..." : "Revoca link"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
