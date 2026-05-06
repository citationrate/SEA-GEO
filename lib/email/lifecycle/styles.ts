/**
 * Design tokens + HTML layout helpers per lifecycle emails.
 * Dark theme — CitationRate brand.
 */

export const colors = {
  bg: "#0d1a14",
  card: "#0d1a14",
  text: "#e8f0eb",
  textMuted: "#9ab8a4",
  textLight: "#9ab8a4",
  border: "#1e3328",
  primary: "#6dbf94",
  primaryFg: "#0d1014",
  link: "#6dbf94",
  divider: "#1e3328",
  featureBg: "#132019",
  featureBorder: "#6dbf94",
  featureBorderLight: "#1e3328",
};

export const fonts = {
  ui: "Arial, sans-serif",
  mono: "'Courier New', monospace",
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
            font-weight:700;
            font-size:12px;
            line-height:1;
            padding:14px 28px;
            text-decoration:none;
            letter-spacing:1.5px;
            text-transform:uppercase;
            mso-padding-alt:0;
          ">
            <!--[if mso]>
            <i style="letter-spacing:28px;mso-font-width:-100%;mso-text-raise:30pt;">&nbsp;</i>
            <![endif]-->
            <span style="mso-text-raise:15pt;">${escapeHtml(label)} &rarr;</span>
            <!--[if mso]>
            <i style="letter-spacing:28px;mso-font-width:-100%;">&nbsp;</i>
            <![endif]-->
          </a>
        </td>
      </tr>
    </table>
  `;
}

/** Secondary link (underlined, no button background) */
export function emailLink(href: string, label: string): string {
  return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener" style="
    color:${colors.primary};
    font-family:${fonts.ui};
    font-weight:700;
    font-size:12px;
    letter-spacing:1.5px;
    text-transform:uppercase;
    text-decoration:none;
    border-bottom:1px solid ${colors.primary};
    padding-bottom:2px;
  ">${escapeHtml(label)} &rarr;</a>`;
}

/** Feature card with green border (primary CTA card) */
export function featureCard(opts: { label: string; title: string; description: string; ctaHtml: string }): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;border:1.5px solid ${colors.featureBorder};background:${colors.featureBg};">
      <tr>
        <td style="padding:24px 28px;">
          <div style="font-family:${fonts.ui};font-size:10px;font-weight:700;letter-spacing:2px;color:${colors.textMuted};text-transform:uppercase;margin-bottom:8px;">
            ${opts.label}
          </div>
          <div style="font-family:${fonts.ui};font-size:17px;font-weight:700;color:#ffffff;margin-bottom:10px;line-height:1.3;">
            ${opts.title}
          </div>
          <div style="font-family:${fonts.ui};font-size:15px;color:${colors.textMuted};line-height:1.65;margin-bottom:16px;">
            ${opts.description}
          </div>
          ${opts.ctaHtml}
        </td>
      </tr>
    </table>
  `;
}

/** Feature card with light border (secondary CTA card) */
export function featureCardLight(opts: { label: string; title: string; description: string; ctaHtml: string }): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;border:0.5px solid ${colors.featureBorderLight};background:${colors.featureBg};">
      <tr>
        <td style="padding:24px 28px;">
          <div style="font-family:${fonts.ui};font-size:10px;font-weight:700;letter-spacing:2px;color:${colors.textMuted};text-transform:uppercase;margin-bottom:8px;">
            ${opts.label}
          </div>
          <div style="font-family:${fonts.ui};font-size:17px;font-weight:700;color:#ffffff;margin-bottom:10px;line-height:1.3;">
            ${opts.title}
          </div>
          <div style="font-family:${fonts.ui};font-size:15px;color:${colors.textMuted};line-height:1.65;margin-bottom:16px;">
            ${opts.description}
          </div>
          ${opts.ctaHtml}
        </td>
      </tr>
    </table>
  `;
}

/** Section label (small uppercase muted text) */
export function sectionLabel(text: string): string {
  return `<div style="font-family:${fonts.ui};font-size:10px;font-weight:700;letter-spacing:2px;color:${colors.textMuted};text-transform:uppercase;margin-bottom:8px;">${escapeHtml(text)}</div>`;
}

/** Large heading (white bold, optional green italic accent line) */
export function heading(line1: string, accentLine?: string): string {
  let html = `<div style="font-family:${fonts.ui};font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;margin-bottom:4px;">${line1}</div>`;
  if (accentLine) {
    html += `<div style="font-family:${fonts.ui};font-size:28px;font-weight:700;color:${colors.primary};font-style:italic;line-height:1.2;margin-bottom:20px;">${accentLine}</div>`;
  } else {
    html += `<div style="margin-bottom:20px;"></div>`;
  }
  return html;
}

export function emailLayout(opts: { preview: string; bodyInner: string; lang?: string }): string {
  const lang = opts.lang || "it";
  const f = {
    team: "Team CitationRate",
    reply: "Se hai domande, rispondi a questa mail. Ci siamo.<br><em style=\"color:" + colors.textMuted + ";font-size:14px;\">If you have questions, just reply to this email. We're here.</em>",
    address: "CitationRate &middot; suite.citationrate.com &middot; avi.citationrate.com",
  };

  return `<!DOCTYPE html>
<html lang="${escapeAttr(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>CitationRate</title>
  <style>
    body { margin:0; padding:0; background:${colors.bg}; }
    a { color:${colors.link}; }
    @media (max-width:600px) {
      .container { width:100% !important; padding:16px !important; }
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
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${colors.card};">
          <tr>
            <td style="padding:40px 32px;">
              <!-- Logo -->
              <div style="font-family:${fonts.ui};font-size:16px;font-weight:700;letter-spacing:2px;color:${colors.primary};text-transform:lowercase;margin-bottom:32px;">
                citationrate
              </div>
              <!-- Body -->
              <div style="font-family:${fonts.ui};font-size:15px;line-height:1.65;color:${colors.text};">
                ${opts.bodyInner}
              </div>
              <!-- Divider -->
              <div style="margin-top:36px;height:0.5px;background:${colors.divider};"></div>
              <!-- Footer signature -->
              <div style="margin-top:24px;font-family:${fonts.ui};font-size:15px;color:${colors.textMuted};line-height:1.65;">
                ${f.reply}<br>
                <strong style="color:${colors.primary};">&mdash; ${escapeHtml(f.team)}</strong>
              </div>
            </td>
          </tr>
        </table>
        <!-- Sub-footer -->
        <div style="margin-top:16px;padding-top:16px;border-top:0.5px solid ${colors.divider};font-family:${fonts.ui};font-size:12px;color:${colors.textMuted};text-align:center;">
          ${f.address}
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
  return `<p style="margin:0 0 16px 0;font-family:${fonts.ui};font-size:15px;line-height:1.65;color:${colors.text};">${html}</p>`;
}

export function statTable(rows: Array<[string, string]>): string {
  const tds = rows
    .map(
      ([label, value]) => `
    <tr>
      <td style="padding:8px 0;font-family:${fonts.ui};color:${colors.textMuted};font-size:14px;width:180px;border-bottom:0.5px solid ${colors.divider};">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#ffffff;font-size:14px;font-weight:700;font-family:${fonts.mono};border-bottom:0.5px solid ${colors.divider};">${value}</td>
    </tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;width:100%;border-collapse:collapse;">${tds}</table>`;
}
