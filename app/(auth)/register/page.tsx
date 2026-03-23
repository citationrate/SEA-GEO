"use client";

import { RegisterForm } from "@/components/auth/register-form";
import { useTranslation } from "@/lib/i18n/context";

export default function RegisterPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-dots flex items-center justify-center p-4 relative" style={{ background: "var(--background)" }}>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-3xl pointer-events-none" style={{ background: "var(--primary-glow)" }} />

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <img src="/logo.jpg" alt="AVI" width={36} height={36} className="rounded-lg" />
            <span className="font-display text-2xl text-foreground" style={{ fontWeight: 300 }}>A<span style={{ color: "#7ab89a" }}>VI</span></span>
          </div>
          <p className="text-sm text-muted-foreground font-sans">AI Visibility Intelligence</p>
        </div>

        <div className="card">
          <h1 className="font-display text-lg text-foreground mb-1" style={{ fontWeight: 300 }}>{t("auth.createYourAccount")}</h1>
          <p className="text-sm text-muted-foreground mb-6 font-sans">{t("auth.registerSubtitle")}</p>
          <RegisterForm />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5 font-sans">
          {t("auth.haveAccount")}{" "}
          <a href="/login" className="text-primary hover:text-primary-hover transition-colors font-medium">
            {t("auth.login")}
          </a>
        </p>
      </div>
    </div>
  );
}
