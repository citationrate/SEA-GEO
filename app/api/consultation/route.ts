import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(1),
  azienda: z.string().min(1),
  email: z.string().email(),
  urls: z.string().min(1),
  obiettivo: z.string().min(1),
  dati_non_chiari: z.string().optional(),
  gestione: z.string().min(1),
  settore: z.string().min(1),
  disponibilita: z.array(z.string()).min(1),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Compila tutti i campi obbligatori per inviare la richiesta." }, { status: 400 });
    }

    const d = parsed.data;

    const resend = new Resend(process.env.RESEND_API_KEY);

    const htmlBody = wrapEmail(`
      <h2 style="color:#f5f0e8;font-size:18px;margin:0 0 20px;">Nuova richiesta di consulenza</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:6px 0;color:#888;font-size:13px;width:140px">Nome</td><td style="padding:6px 0;color:#f5f0e8;font-size:14px">${esc(d.nome)}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px">Azienda</td><td style="padding:6px 0;color:#f5f0e8;font-size:14px">${esc(d.azienda)}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px">Email</td><td style="padding:6px 0;color:#8dc5a7;font-size:14px"><a href="mailto:${esc(d.email)}" style="color:#8dc5a7;text-decoration:none;">${esc(d.email)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px">URLs</td><td style="padding:6px 0;color:#aaa;font-size:13px;white-space:pre-wrap">${esc(d.urls)}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px">Obiettivo</td><td style="padding:6px 0;color:#f5f0e8;font-size:14px">${esc(d.obiettivo)}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px">Non chiaro</td><td style="padding:6px 0;color:#aaa;font-size:13px">${d.dati_non_chiari ? esc(d.dati_non_chiari) : "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px">Gestione AI</td><td style="padding:6px 0;color:#f5f0e8;font-size:14px">${esc(d.gestione)}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px">Settore</td><td style="padding:6px 0;color:#f5f0e8;font-size:14px">${esc(d.settore)}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px">Disponibilit&agrave;</td><td style="padding:6px 0;color:#aaa;font-size:13px">${d.disponibilita.map(s => esc(s)).join(", ")}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px">Note</td><td style="padding:6px 0;color:#aaa;font-size:13px">${d.note ? esc(d.note) : "—"}</td></tr>
      </table>`);

    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@aicitationrate.com";
    const fromAddress = `AI Visibility Index <${fromEmail}>`;

    // Send to team
    await resend.emails.send({
      from: fromAddress,
      to: process.env.CONSULTATION_EMAIL || "info@citationrate.com",
      subject: `Nuova richiesta di consulenza — ${d.nome} (${d.azienda})`,
      html: htmlBody,
      replyTo: d.email,
    });

    // Send confirmation to user (branded template)
    await resend.emails.send({
      from: fromAddress,
      to: d.email,
      subject: "Abbiamo ricevuto la tua richiesta di consulenza",
      html: wrapEmail(`
      <h2 style="color:#f5f0e8;font-size:18px;margin:0 0 12px;">Richiesta ricevuta</h2>
      <p style="color:#aaa;font-size:14px;line-height:1.6;margin:0 0 8px;">
        Ciao <strong style="color:#f5f0e8;">${esc(d.nome)}</strong>,
      </p>
      <p style="color:#aaa;font-size:14px;line-height:1.6;margin:0 0 24px;">
        abbiamo ricevuto la tua richiesta di consulenza per <strong style="color:#f5f0e8;">${esc(d.azienda)}</strong>.
        Un nostro esperto ti contatter&agrave; entro <strong style="color:#8dc5a7;">24 ore lavorative</strong>.
      </p>
      <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:4px;padding:16px;margin:0 0 24px;">
        <p style="color:#888;font-size:12px;margin:0 0 4px;">Riepilogo</p>
        <p style="color:#f5f0e8;font-size:14px;margin:0;"><strong>${esc(d.azienda)}</strong> &middot; ${esc(d.settore)} &middot; ${esc(d.gestione)}</p>
      </div>
      <p style="color:#666;font-size:12px;line-height:1.5;margin:0;">
        Se hai domande nel frattempo, rispondi a questa email.
      </p>`),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[consultation] error:", err);
    return NextResponse.json({ error: "Errore nell'invio. Riprova." }, { status: 500 });
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapEmail(content: string): string {
  return `<div style="background-color:#0a0a0a;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:4px;padding:40px;">
    <div style="text-align:center;margin-bottom:30px;">
      <img src="https://suite.citationrate.com/logo-email.png" alt="Citability Score" width="48" height="48" style="vertical-align:middle;border-radius:12px;" />
      <h1 style="color:#f5f0e8;font-size:20px;margin:16px 0 4px;">Citability Score</h1>
      <p style="color:#888;font-size:13px;margin:0;">AI Visibility Audit</p>
    </div>
    ${content}
    <hr style="border:none;border-top:1px solid #2a2a2a;margin:30px 0 20px;">
    <p style="color:#555;font-size:11px;text-align:center;margin:0;">
      Citability Score &mdash; <a href="https://suite.citationrate.com" style="color:#8dc5a7;text-decoration:none;">suite.citationrate.com</a>
    </p>
  </div>
</div>`;
}
