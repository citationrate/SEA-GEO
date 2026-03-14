"use client";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { useTranslation } from "@/lib/i18n/context";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-dots flex items-center justify-center p-4 relative" style={{ background: "var(--background)" }}>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-3xl pointer-events-none" style={{ background: "var(--primary-glow)" }} />

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-[2px] flex items-center justify-center glow-primary" style={{ background: "var(--primary-glow)", border: "1px solid var(--primary-hover)" }}>
              <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="font-display text-2xl text-foreground" style={{ fontWeight: 300 }}>SeaGeo</span>
          </div>
          <p className="text-sm text-muted-foreground font-sans">AI Visibility Intelligence</p>
        </div>

        <div className="card">
          <h1 className="font-display text-lg text-foreground mb-1" style={{ fontWeight: 300 }}>{t("auth.forgotTitle")}</h1>
          <p className="text-sm text-muted-foreground mb-6 font-sans">{t("auth.forgotSubtitle")}</p>
          <ForgotPasswordForm />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5 font-sans">
          {t("auth.rememberPassword")}{" "}
          <a href="/login" className="text-primary hover:text-primary-hover transition-colors font-medium">
            {t("auth.login")}
          </a>
        </p>
      </div>
    </div>
  );
}
