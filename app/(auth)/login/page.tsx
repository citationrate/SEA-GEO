"use client";

import { LoginForm } from "@/components/auth/login-form";
import { useTranslation } from "@/lib/i18n/context";

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-dots flex items-center justify-center p-4 relative" style={{ background: "var(--background)" }}>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-3xl pointer-events-none" style={{ background: "var(--primary-glow)" }} />

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#7ab89a"/>
              <circle cx="13" cy="10" r="8" fill="white"/>
              <path d="M5 13 C4 19 2 24 0 29 C4 27 9 22 13 17 Z" fill="white"/>
              <circle cx="26" cy="13" r="7" fill="#3d6b52"/>
              <path d="M19 16 C18 21 16 26 13 31 C17 29 22 24 25 19 Z" fill="#3d6b52"/>
            </svg>
            <span className="font-display text-2xl text-foreground" style={{ fontWeight: 300 }}>Sea<span style={{ color: "#7ab89a" }}>Geo</span></span>
          </div>
          <p className="text-sm text-muted-foreground font-sans">AI Visibility Intelligence</p>
        </div>

        <div className="card">
          <h1 className="font-display text-lg text-foreground mb-1" style={{ fontWeight: 300 }}>{t("auth.welcomeBack")}</h1>
          <p className="text-sm text-muted-foreground mb-6 font-sans">{t("auth.loginSubtitle")}</p>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5 font-sans">
          {t("auth.noAccount")}{" "}
          <a href="/register" className="text-primary hover:text-primary-hover transition-colors font-medium">
            {t("auth.register")}
          </a>
        </p>
      </div>
    </div>
  );
}
