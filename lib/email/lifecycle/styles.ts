/**
 * Design tokens + HTML layout helpers per lifecycle emails.
 * Style estratti da aivx-frontend (Tailwind config + globals.css):
 *   - Primary sage: #7eb098
 *   - Font UI: Syne (con fallback per Outlook desktop)
 *   - Border radius: 2px
 */

export const colors = {
  bg: "#fafaf9",
  card: "#ffffff",
  text: "#0d1014",
  textMuted: "#525860",
  textLight: "#8a8f96",
  border: "#e5e7eb",
  primary: "#7eb098",
  primaryDark: "#3d7a5a",
  primaryFg: "#0d1014",
  link: "#5ba4cf",
  divider: "#e8e8e8",
};

export const fonts = {
  ui: "Syne, 'Helvetica Neue', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

export function emailButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
      <tr>
        <td>
          <a href="${escapeAttr(href)}" target="_blank" rel="noopener" style="
            display:inline-block;
            background-color:${colors.primary};
            color:${colors.primaryFg};
            font-family:${fonts.ui};
            font-weight:600;
            font-size:15px;
            line-height:1;
            padding:14px 28px;
            border-radius:2px;
            text-decoration:none;
            mso-padding-alt:0;
          ">
            <!--[if mso]>
            <i style="letter-spacing:28px;mso-font-width:-100%;mso-text-raise:30pt;">&nbsp;</i>
            <![endif]-->
            <span style="mso-text-raise:15pt;">${escapeHtml(label)}</span>
            <!--[if mso]>
            <i style="letter-spacing:28px;mso-font-width:-100%;">&nbsp;</i>
            <![endif]-->
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function emailLayout(opts: { preview: string; bodyInner: string; lang?: string }): string {
  const lang = opts.lang || "it";
  const footerByLang: Record<string, { team: string; reply: string; address: string }> = {
    it: {
      team: "Team CitationRate",
      reply: "Per qualsiasi dubbio rispondi a questa mail, siamo a disposizione.",
      address: "CitationRate · suite.citationrate.com · avi.citationrate.com",
    },
    en: {
      team: "The CitationRate Team",
      reply: "For any questions just reply to this email, we are happy to help.",
      address: "CitationRate · suite.citationrate.com · avi.citationrate.com",
    },
  };
  const f = footerByLang[lang] || footerByLang.it;

  return `<!DOCTYPE html>
<html lang="${escapeAttr(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>CitationRate</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin:0; padding:0; background:${colors.bg}; }
    a { color:${colors.link}; }
    @media (max-width:600px) {
      .container { width:100% !important; padding:16px !important; }
      .button-wrap a { display:block !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${colors.bg};font-family:${fonts.ui};color:${colors.text};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(opts.preview)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${colors.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:${colors.card};border-radius:2px;border:1px solid ${colors.border};">
          <tr>
            <td style="padding:32px 36px;">
              <div style="font-family:${fonts.ui};font-size:14px;font-weight:600;letter-spacing:0.5px;color:${colors.primaryDark};text-transform:uppercase;margin-bottom:24px;">
                CitationRate
              </div>
              <div style="font-family:${fonts.ui};font-size:15px;line-height:1.6;color:${colors.text};">
                ${opts.bodyInner}
              </div>
              <div style="margin-top:32px;padding-top:20px;border-top:1px solid ${colors.divider};font-family:${fonts.ui};font-size:14px;color:${colors.textMuted};line-height:1.5;">
                ${escapeHtml(f.reply)}<br><br>
                <strong style="color:${colors.text};">${escapeHtml(f.team)}</strong>
              </div>
            </td>
          </tr>
        </table>
        <div style="font-family:${fonts.ui};font-size:11px;color:${colors.textLight};margin-top:16px;text-align:center;">
          ${escapeHtml(f.address)}
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function escapeHtml(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export function scoreZone(score: number, lang: string = "it"): string {
  const t = (it: string, en: string) => (lang === "en" ? en : it);
  if (score >= 86) return t("eccellente", "excellent");
  if (score >= 71) return t("ottima", "great");
  if (score >= 51) return t("buona", "good");
  if (score >= 31) return t("da migliorare", "needs improvement");
  return t("critica", "critical");
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px 0;">${html}</p>`;
}

export function statTable(rows: Array<[string, string]>): string {
  const tds = rows
    .map(
      ([label, value]) => `
    <tr>
      <td style="padding:6px 0;color:${colors.textMuted};font-size:14px;width:160px;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;color:${colors.text};font-size:14px;font-weight:600;font-family:${fonts.mono};">${value}</td>
    </tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-collapse:collapse;">${tds}</table>`;
}
