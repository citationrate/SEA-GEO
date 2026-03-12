"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center py-4 space-y-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        </div>
        <p className="text-sm text-foreground font-sans font-medium">Email inviata!</p>
        <p className="text-xs text-muted-foreground font-sans">
          Controlla la tua email per il link di reset della password.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5 font-sans font-medium">Email</label>
        <input
          type="email"
          required
          placeholder="nome@azienda.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-base"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full font-sans font-semibold uppercase tracking-wide rounded-[2px] px-4 py-2.5 text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
        style={{ background: "var(--primary)", color: "var(--background)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--cream)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.transform = "none"; }}
      >
        {loading && <Spinner />}
        Invia link di reset
      </button>
    </form>
  );
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />;
}
