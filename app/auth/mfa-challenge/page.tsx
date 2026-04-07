"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function MfaChallengePage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        // Nothing to challenge → straight to dashboard
        router.replace(next);
        return;
      }
      setFactorId(totp.id);
    })();
  }, [supabase, router, next]);

  async function submit() {
    if (!factorId || code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
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
      router.replace(next);
    } catch (e: any) {
      setError(e?.message || "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="card p-8 w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <div>
            <h1 className="font-display font-bold text-xl text-foreground">Verifica in due passaggi</h1>
            <p className="text-sm text-muted-foreground">Inserisci il codice dalla tua app authenticator</p>
          </div>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="w-full bg-muted/30 border border-border rounded-[2px] px-3 py-3 text-center text-2xl font-mono tracking-[8px] text-foreground focus:outline-none focus:border-primary"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.length === 6) submit();
            }}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-[2px] px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={loading || code.length !== 6 || !factorId}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-sm hover:bg-primary/85 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Verifica
        </button>

        <button
          type="button"
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="w-3 h-3" /> Esci
        </button>
      </div>
    </div>
  );
}
