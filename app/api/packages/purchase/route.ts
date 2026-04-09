import { NextResponse } from "next/server";

// Endpoint disabled — package purchases are fulfilled exclusively by the
// Stripe webhook (checkout.session.completed → addToWallet). This route
// previously simulated purchases without payment verification.
// Re-enable only after implementing proper Stripe payment flow.

export async function POST() {
  return NextResponse.json(
    { error: "Acquisto pacchetti non disponibile da questo endpoint. Usa il checkout Stripe." },
    { status: 503 },
  );
}
