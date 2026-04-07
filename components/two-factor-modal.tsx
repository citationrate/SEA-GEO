"use client";

import { useEffect, useState } from "react";
import { X, Loader2, ShieldCheck, Copy, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/context";

interface Props {
  open: boolean;
  onClose: () => void;
  onEnrolled: (factorId: string) => void;
}

/**
 * Two-factor (TOTP) enrollment modal.
 * Step 1: enroll → Supabase returns QR code SVG + secret
 * Step 2: user scans with authenticator app
 * Step 3: user types 6-digit code → challenge + verify
 * On success the session becomes aal2.
 */
export function TwoFactorModal({ open, onClose, onEnrolled }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  // On open: enroll a new TOTP factor (after cleaning up any unverified leftovers)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setCode("");
      try {
        const supabase = createClient();
        // Clean up any unverified factors from previous attempts
        const { data: list } = await supabase.auth.mfa.listFactors();
        const stale = list?.totp?.filter((f) => f.status !== "verified") ?? [];
        for (const f of stale) {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }

        const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `AVI - ${new Date().toISOString().slice(0, 10)}`,
        });
        if (cancelled) return;
        if (enrollErr || !data) {
          setError(enrollErr?.message || "Errore nell'avvio dell'enrollment");
          return;
        }
        setFactorId(data.id);
        setQrSvg(data.totp.qr_code);
        setSecret(data.totp.secret);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Errore sconosciuto");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function verify() {
    if (!factorId || code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr || !ch) {
        setError(chErr?.message || "Errore nella challenge");
        return;
      }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code,
      });
      if (vErr) {
        setError(vErr.message || "Codice non valido");
        return;
      }
      onEnrolled(factorId);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }

  async function handleClose() {
    // If user closes without verifying, remove the half-enrolled factor
    if (factorId) {
      try {
        const supabase = createClient();
        await supabase.auth.mfa.unenroll({ factorId });
      } catch {
        /* ignore */
      }
    }
    setFactorId(null);
    setQrSvg(null);
    setSecret(null);
    setCode("");
    setError(null);
    onClose();
  }

  function copySecret() {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="font-display font-bold text-lg text-foreground">
              {t("settings.tfmodalTitle")}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-5">
          <li>{t("settings.tfstep1")}</li>
          <li>{t("settings.tfstep2")}</li>
          <li>{t("settings.tfstep3")}</li>
        </ol>

        {loading && !qrSvg && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("settings.tfgeneratingQr")}
          </div>
        )}

        {qrSvg && (
          <div className="flex flex-col items-center gap-3">
            <img
              src={qrSvg}
              alt={t("settings.tfqrAlt")}
              className="bg-white p-3 rounded-md w-48 h-48"
            />
            {secret && (
              <div className="w-full">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                  {t("settings.tfmanualEntry")}
                </p>
                <div className="flex items-center gap-2 bg-muted/30 rounded-[2px] px-3 py-2">
                  <code className="text-xs font-mono text-foreground break-all flex-1">{secret}</code>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                    aria-label="Copy"
                  >
                    {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {qrSvg && (
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("settings.tfcodeLabel")}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full bg-muted/30 border border-border rounded-[2px] px-3 py-2 text-center text-lg font-mono tracking-[6px] text-foreground focus:outline-none focus:border-primary"
              autoFocus
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-[2px] px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 text-sm font-semibold py-2.5 rounded-sm border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={verify}
            disabled={loading || code.length !== 6 || !factorId}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-sm hover:bg-primary/85 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {t("settings.tfactivate")}
          </button>
        </div>
      </div>
    </div>
  );
}
