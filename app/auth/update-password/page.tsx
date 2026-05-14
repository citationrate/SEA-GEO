"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Check, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export default function UpdatePasswordPage() {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const router = useRouter();

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        setError(t("auth.invalidSession"));
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
          <h1 className="font-display text-xl font-bold text-foreground">{t("auth.updatePwdTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("auth.updatePwdSubtitle")}</p>
        </div>

        {done ? (
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-foreground font-medium">{t("auth.pwdUpdated")}</p>
            <p className="text-xs text-muted-foreground">{t("auth.redirectingDashboard")}</p>
          </div>
        ) : error && !ready ? (
          <div className="text-center space-y-3">
            <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
            <a href="/settings#account" className="text-sm text-primary hover:text-primary/80 transition-colors">{t("auth.backToSettings")}</a>
          </div>
        ) : !ready ? (
          <div className="text-center space-y-3 py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">{t("auth.verifying")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">{t("auth.newPasswordLabel")}</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.minChars")}
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
              <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">{t("auth.confirmPasswordLabel")}</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t("auth.repeatPlaceholder")}
                className="w-full rounded-[3px] px-3 py-2.5 text-sm text-foreground"
                style={{ background: "var(--background, #0a0a0a)", border: `1px solid ${confirm && confirm !== password ? "#ef4444" : "var(--border, #2a2a2a)"}`, outline: "none" }}
              />
              {confirm && confirm !== password && (
                <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{t("auth.pwdMismatch")}</p>
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
              {loading ? t("auth.updatingPwd") : t("auth.updatePwd")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
