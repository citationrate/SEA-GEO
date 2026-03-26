"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type"); // "subscription" or "package"
  const subscriptionId = searchParams.get("subscription_id");
  const orderId = searchParams.get("token"); // PayPal passes order token
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (done || processing) return;

    // Subscription: confirm and activate plan
    if (type === "subscription" && subscriptionId) {
      setProcessing(true);
      fetch("/api/paypal/confirm-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) {
            setDone(true);
            setPlan(data.plan);
          } else {
            setError(data.error || "Errore nella conferma");
          }
        })
        .catch(() => setError("Errore di rete"))
        .finally(() => setProcessing(false));
      return;
    }

    // Package: capture payment
    if (type === "package" && orderId) {
      setProcessing(true);
      fetch("/api/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
        .then(async (res) => {
          if (res.ok) {
            setDone(true);
          } else {
            const data = await res.json();
            setError(data.error || "Errore nella conferma del pagamento");
          }
        })
        .catch(() => setError("Errore di rete"))
        .finally(() => setProcessing(false));
      return;
    }

    // No subscription_id and no token — just show success
    if (type === "subscription" || type === "package") {
      setDone(true);
    }
  }, [type, subscriptionId, orderId, done, processing]);

  const isSubscription = type === "subscription";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="card max-w-md w-full p-8 text-center space-y-6">
        {processing ? (
          <>
            <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
            <h1 className="text-xl font-display font-bold text-foreground">
              {isSubscription ? "Attivazione piano in corso..." : "Conferma pagamento in corso..."}
            </h1>
            <p className="text-sm text-muted-foreground">
              Non chiudere questa pagina.
            </p>
          </>
        ) : error ? (
          <>
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <span className="text-destructive text-2xl font-bold">!</span>
            </div>
            <h1 className="text-xl font-display font-bold text-foreground">
              Errore
            </h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link
              href="/settings"
              className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold hover:bg-primary/80 transition-colors"
            >
              Torna alle impostazioni
            </Link>
          </>
        ) : done ? (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground">
              {isSubscription ? "Abbonamento attivato!" : "Acquisto completato!"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isSubscription
                ? `Il piano ${plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : ""} è ora attivo. Tutte le funzionalità sono state sbloccate.`
                : "Il pacchetto extra è stato aggiunto al tuo account."}
            </p>
            {subscriptionId && (
              <p className="text-xs text-muted-foreground font-mono">
                ID: {subscriptionId}
              </p>
            )}
            <Link
              href={isSubscription ? "/dashboard" : "/settings"}
              className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold hover:bg-primary/80 transition-colors"
            >
              {isSubscription ? "Vai alla dashboard" : "Torna alle impostazioni"}
            </Link>
          </>
        ) : (
          <Loader2 className="w-8 h-8 text-muted-foreground mx-auto animate-spin" />
        )}
      </div>
    </div>
  );
}
