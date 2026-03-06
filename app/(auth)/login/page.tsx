import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Accedi" };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background bg-dots flex items-center justify-center p-4 relative">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
              <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="font-display font-bold text-2xl text-foreground">SeaGeo</span>
          </div>
          <p className="text-sm text-muted-foreground">AI Visibility Intelligence</p>
        </div>

        {/* Card */}
        <div className="card p-7">
          <h1 className="font-display font-semibold text-lg text-foreground mb-1">Bentornato</h1>
          <p className="text-sm text-muted-foreground mb-6">Accedi al tuo account SeaGeo</p>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          Non hai un account?{" "}
          <a href="/register" className="text-primary hover:text-primary/70 transition-colors font-medium">
            Registrati
          </a>
        </p>
      </div>
    </div>
  );
}
