import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { subject, message } = await request.json();
    if (!subject?.trim() || !message?.trim() || message.trim().length < 10) {
      return NextResponse.json({ error: "Compila tutti i campi" }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("[support] RESEND_API_KEY not configured");
      return NextResponse.json(
        { error: "Servizio email non configurato. Contatta l'amministratore." },
        { status: 503 },
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@aicitationrate.com";
    const toEmail = process.env.CONSULTATION_EMAIL || "info@citationrate.com";

    const sendResult = await resend.emails.send({
      from: `AVI Support <${fromEmail}>`,
      to: toEmail,
      replyTo: user!.email!,
      subject: `[AVI Support] ${subject.trim()}`,
      html: `
        <p><strong>Da:</strong> ${user!.email}</p>
        <p><strong>User ID:</strong> ${user!.id}</p>
        <p><strong>Oggetto:</strong> ${subject.trim()}</p>
        <hr/>
        <p style="white-space:pre-wrap">${message.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      `,
    });

    if (sendResult.error) {
      console.error("[support] resend error:", sendResult.error);
      return NextResponse.json(
        { error: `Resend: ${sendResult.error.message || "errore sconosciuto"}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, id: sendResult.data?.id });
  } catch (err: any) {
    console.error("[support] error:", err?.message);
    return NextResponse.json({ error: "Errore nell'invio" }, { status: 500 });
  }
}
