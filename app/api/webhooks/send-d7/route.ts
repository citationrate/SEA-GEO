import { NextResponse } from "next/server";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { sendLifecycleEmail } from "@/lib/email/lifecycle/send";
import { detectLang } from "@/lib/email/lifecycle/lang-detect";
import { emailLayout, escapeHtml, paragraph, emailButton } from "@/lib/email/lifecycle/styles";
import { MINI_TOOL_CONFIG, getCrossSellLabels } from "@/lib/email/lifecycle/mini-tool-emails";
import type { EmailType } from "@/lib/email/lifecycle/templates";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, userId, tool, label } = body as {
      type: "D7_TIPS" | "D7_CROSS";
      userId: string;
      tool: string;
      label: string;
    };

    if (!userId || !tool) {
      return NextResponse.json({ error: "missing userId or tool" }, { status: 400 });
    }

    const config = MINI_TOOL_CONFIG[tool];
    if (!config) {
      return NextResponse.json({ error: "unknown tool" }, { status: 400 });
    }

    // Fetch user data
    const cr = createCitationRateServiceClient();
    const { data: profile } = await (cr.from("profiles") as any)
      .select("full_name, plan, lang, is_admin")
      .eq("id", userId)
      .maybeSingle();
    if (!profile || profile.is_admin) {
      return NextResponse.json({ ok: false, skipped: "admin_or_not_found" });
    }

    const { data: { user } } = await (cr.auth.admin as any).getUserById(userId);
    if (!user) return NextResponse.json({ ok: false, skipped: "no_auth_user" });

    const lang = detectLang({ email: user.email, profileLang: profile.lang });
    const name = profile.full_name || (lang === "en" ? "there" : "ciao");
    const suiteUrl = "https://suite.citationrate.com";

    let subject: string;
    let html: string;
    let emailType: EmailType;

    if (type === "D7_TIPS") {
      emailType = "D7_TIPS";
      subject = config.tipsSubject;

      const bodyIt = [
        paragraph(`Ciao ${escapeHtml(name)},`),
        paragraph(`hai appena aperto <strong>${escapeHtml(config.label)}</strong> nella Suite. Ottima scelta.`),
        paragraph(`Ecco 3 consigli per sfruttarlo al meglio:`),
        paragraph(
          `1. <strong>Analizza i dati con attenzione</strong> — non guardare solo i numeri, cerca i pattern e le anomalie.<br>` +
          `2. <strong>Confronta nel tempo</strong> — torna tra una settimana e vedi come cambiano i risultati.<br>` +
          `3. <strong>Agisci sui risultati</strong> — ogni insight vale solo se lo trasformi in un'azione concreta.`
        ),
        emailButton(`${suiteUrl}/${tool.replace(/_/g, "-")}`, `Apri ${config.label}`),
      ].join("");

      html = emailLayout({
        lang: "it",
        preview: config.tipsPreview,
        bodyInner: bodyIt,
      });
    } else {
      // D7_CROSS
      emailType = "D7_CROSS";
      subject = config.crossSellSubject;
      const relatedLabels = getCrossSellLabels(tool);
      const relatedLinks = config.crossSellTools
        .map((id) => {
          const c = MINI_TOOL_CONFIG[id];
          if (!c) return "";
          return `&bull; <strong><a href="${suiteUrl}/${id.replace(/_/g, "-")}">${escapeHtml(c.label)}</a></strong> — ${escapeHtml(c.tipsPreview.split("—")[0].trim())}`;
        })
        .filter(Boolean)
        .join("<br>");

      const bodyIt = [
        paragraph(`Ciao ${escapeHtml(name)},`),
        paragraph(`3 giorni fa hai usato <strong>${escapeHtml(config.label)}</strong>. Ecco altri tool che completano il quadro:`),
        paragraph(relatedLinks),
        paragraph(`Ogni tool ti dà un pezzo diverso della visibilità AI del tuo brand.`),
        emailButton(suiteUrl, "Apri la Suite"),
      ].join("");

      html = emailLayout({
        lang: "it",
        preview: `Dopo ${config.label}: scopri anche ${relatedLabels.join(" e ")}`,
        bodyInner: bodyIt,
      });
    }

    const r = await sendLifecycleEmail({
      userId,
      emailType,
      recipientEmail: user.email,
      lang,
      subject,
      html,
      payload: { full_name: profile.full_name, tool, tool_label: config.label, plan: profile.plan },
    });

    return NextResponse.json({ ok: r.ok, skipped: r.skipped, error: r.error });
  } catch (e: any) {
    console.error("[send-d7] error:", e?.message);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
