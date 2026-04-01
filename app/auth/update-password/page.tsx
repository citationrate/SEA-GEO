"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Loader2, Check, Eye, EyeOff } from "lucide-react";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Session was already established by the callback route.
  // Just verify we have one.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        setError("Sessione non valida. Richiedi un nuovo link di reset.");
      }
    });
  }, []);

  const valid = password.length >= 8 && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background, #0a0a0a)" }}>
      <div className="w-full max-w-sm p-8 rounded-[4px]" style={{ background: "var(--surface, #141416)", border: "1px solid var(--border, #2a2a2a)" }}>
        <div className="text-center mb-8">
          <h1 className="font-display text-xl font-bold text-foreground">Nuova password</h1>
          <p className="text-sm text-muted-foreground mt-1">Scegli una nuova password per il tuo account</p>
        </div>

        {done ? (
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-foreground font-medium">Password aggiornata!</p>
            <p className="text-xs text-muted-foreground">Verrai reindirizzato alla dashboard...</p>
          </div>
        ) : error && !ready ? (
          <div className="text-center space-y-3">
            <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
            <a href="/settings#account" className="text-sm text-primary hover:text-primary/80 transition-colors">Torna alle impostazioni</a>
          </div>
        ) : !ready ? (
          <div className="text-center space-y-3 py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Verifica in corso...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Nuova password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 8 caratteri"
                  className="w-full rounded-[3px] px-3 py-2.5 text-sm text-foreground pr-10"
                  style={{ background: "var(--background, #0a0a0a)", border: "1px solid var(--border, #2a2a2a)", outline: "none" }}
                  autoFocus
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Conferma password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Ripeti la password"
                className="w-full rounded-[3px] px-3 py-2.5 text-sm text-foreground"
                style={{ background: "var(--background, #0a0a0a)", border: `1px solid ${confirm && confirm !== password ? "#ef4444" : "var(--border, #2a2a2a)"}`, outline: "none" }}
              />
              {confirm && confirm !== password && (
                <p className="text-xs mt-1" style={{ color: "#ef4444" }}>Le password non corrispondono</p>
              )}
            </div>
            {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
            <button
              type="submit"
              disabled={!valid || loading}
              className="w-full py-2.5 rounded-[3px] text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "var(--primary, #7ab89a)", color: "white" }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Aggiornamento..." : "Aggiorna password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
