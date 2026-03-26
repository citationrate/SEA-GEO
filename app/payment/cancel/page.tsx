"use client";

import Link from "next/link";
import { XCircle } from "lucide-react";

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="card max-w-md w-full p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
          <XCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-display font-bold text-foreground">
          Pagamento annullato
        </h1>
        <p className="text-sm text-muted-foreground">
          Il pagamento non è stato completato. Nessun addebito è stato effettuato.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/settings"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold hover:bg-primary/80 transition-colors"
          >
            Torna ai piani
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Vai alla dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
