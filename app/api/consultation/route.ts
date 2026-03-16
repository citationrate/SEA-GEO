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

    const htmlBody = `
<h2>Nuova richiesta di consulenza SeaGeo</h2>

<h3>1. Informazioni</h3>
<table style="border-collapse:collapse;width:100%">
  <tr><td style="padding:4px 8px;font-weight:bold;width:180px">Nome e Cognome</td><td style="padding:4px 8px">${esc(d.nome)}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:bold">Azienda</td><td style="padding:4px 8px">${esc(d.azienda)}</td></tr>
  <tr><td style="padding:4px 8px;font-weight:bold">Email</td><td style="padding:4px 8px"><a href="mailto:${esc(d.email)}">${esc(d.email)}</a></td></tr>
</table>

<h3>2. Brand / Progetto</h3>
<p style="white-space:pre-wrap">${esc(d.urls)}</p>

<h3>3. Obiettivo</h3>
<p>${esc(d.obiettivo)}</p>

<h3>4. Cosa non &egrave; chiaro</h3>
<p>${d.dati_non_chiari ? esc(d.dati_non_chiari) : "<em>Non specificato</em>"}</p>

<h3>5. Chi gestisce la presenza AI</h3>
<p>${esc(d.gestione)}</p>

<h3>6. Settore</h3>
<p>${esc(d.settore)}</p>

<h3>7. Disponibilit&agrave;</h3>
<ul>${d.disponibilita.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>

<h3>8. Note aggiuntive</h3>
<p>${d.note ? esc(d.note) : "<em>Nessuna nota</em>"}</p>

<hr/>
<p style="color:#888;font-size:12px">Inviato da SeaGeo Consultation Form</p>
`;

    await resend.emails.send({
      from: "SeaGeo <noreply@seageo.it>",
      to: process.env.CONSULTATION_EMAIL || "info@seageo.it",
      subject: `Nuova richiesta di consulenza SeaGeo — ${d.nome} — ${d.azienda}`,
      html: htmlBody,
      replyTo: d.email,
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
