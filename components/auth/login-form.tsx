"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/context";

export function LoginForm() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { t } = useTranslation();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  }

  async function onGoogle() {
    setGLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { toast.error(error.message); setGLoading(false); }
  }

  return (
    <div className="space-y-4">
      {/* Google */}
      <button
        onClick={onGoogle}
        disabled={gLoading}
        className="w-full flex items-center justify-center gap-3 border border-border rounded-[2px] px-4 py-2.5 text-sm text-foreground font-sans font-medium transition-all disabled:opacity-50 hover:bg-surface-2"
        style={{ background: "var(--surface-2)" }}
      >
        {gLoading ? <Spinner /> : <GoogleLogo />}
        {t("auth.continueGoogle")}
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <span className="text-xs text-muted-foreground font-mono">{t("common.or")}</span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* Email + Password */}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5 font-sans font-medium">{t("auth.email")}</label>
          <input type="email" required placeholder={t("auth.emailPlaceholder")}
            value={email} onChange={e => setEmail(e.target.value)}
            className="input-base" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-muted-foreground font-sans font-medium">{t("auth.password")}</label>
            <a href="/forgot-password" className="text-xs text-primary hover:text-primary-hover transition-colors font-sans">{t("auth.forgotPassword")}</a>
          </div>
          <input type="password" required placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
            className="input-base" />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full font-sans font-semibold uppercase tracking-wide rounded-[2px] px-4 py-2.5 text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
          style={{ background: "var(--primary)", color: "var(--background)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--cream)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.transform = "none"; }}
        >
          {loading && <Spinner />}
          {t("auth.login")}
        </button>
      </form>
    </div>
  );
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />;
}

function GoogleLogo() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
