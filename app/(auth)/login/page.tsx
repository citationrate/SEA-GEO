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
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="7" fill="#7ab89a"/>
              <text x="6" y="22" fontSize="20" fontFamily="Georgia, serif" fill="white" opacity="0.9">&ldquo;</text>
              <text x="14" y="22" fontSize="20" fontFamily="Georgia, serif" fill="#3d6b52" opacity="0.85">&ldquo;</text>
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
