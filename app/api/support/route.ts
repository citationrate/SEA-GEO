import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { subject, message } = await request.json();
    if (!subject?.trim() || !message?.trim() || message.trim().length < 3) {
      return NextResponse.json({ error: "Compila oggetto e messaggio (min 3 caratteri)" }, { status: 400 });
    }

    const brevoKey = process.env.BREVO_API_KEY;
    if (!brevoKey) {
      console.error("[support] BREVO_API_KEY not configured");
      return NextResponse.json(
        { error: "Servizio email non configurato. Contatta l'amministratore." },
        { status: 503 },
      );
    }

    const fromEmail = process.env.BREVO_FROM_EMAIL || "info@citationrate.com";
    const toEmail = process.env.CONSULTATION_EMAIL || "info@citationrate.com";

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "AVI Support", email: fromEmail },
        to: [{ email: toEmail }],
        replyTo: { email: user!.email! },
        subject: `[AVI Support] ${subject.trim()}`,
        htmlContent: `
          <p><strong>Da:</strong> ${user!.email}</p>
          <p><strong>User ID:</strong> ${user!.id}</p>
          <p><strong>Oggetto:</strong> ${subject.trim()}</p>
          <hr/>
          <p style="white-space:pre-wrap">${message.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        `,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[support] brevo error:", data);
      return NextResponse.json(
        { error: `Brevo: ${data.message || "errore sconosciuto"}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, id: data.messageId });
  } catch (err: any) {
    console.error("[support] error:", err?.message);
    return NextResponse.json({ error: "Errore nell'invio" }, { status: 500 });
  }
}
