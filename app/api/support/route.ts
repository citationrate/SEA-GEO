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

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@aicitationrate.com";

    await resend.emails.send({
      from: `AVI Support <${fromEmail}>`,
      to: process.env.CONSULTATION_EMAIL || "info@citationrate.com",
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

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[support] error:", err?.message);
    return NextResponse.json({ error: "Errore nell'invio" }, { status: 500 });
  }
}
