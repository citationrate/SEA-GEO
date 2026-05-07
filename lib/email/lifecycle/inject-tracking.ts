/**
 * Inject open pixel + click wrapper into email HTML.
 *
 * - Appends a 1x1 tracking pixel before </body>
 * - Wraps all <a href="..."> links through our click tracker
 *   (skips mailto: and unsubscribe links)
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://avi.citationrate.com";

interface TrackingOptions {
  unsubscribeText?: string | null;
  unsubscribeUrl?: string | null;
}

export function injectTracking(
  html: string,
  trackingId: string,
  options?: TrackingOptions,
): string {
  let result = html;

  // 1. Wrap links through click tracker
  // Match <a href="https://..." or <a href="http://..."
  result = result.replace(
    /<a\s([^>]*?)href="(https?:\/\/[^"]+)"([^>]*?)>/gi,
    (match, before, url, after) => {
      // Skip mailto, unsubscribe, and tracking URLs (avoid double-wrapping)
      if (
        url.includes("mailto:") ||
        url.includes("/api/email/track/") ||
        url.toLowerCase().includes("disiscriviti") ||
        url.toLowerCase().includes("unsubscribe")
      ) {
        return match;
      }
      const trackedUrl = `${BASE_URL}/api/email/track/click?id=${encodeURIComponent(trackingId)}&url=${encodeURIComponent(url)}`;
      return `<a ${before}href="${trackedUrl}"${after}>`;
    },
  );

  // 2. Append tracking pixel + unsubscribe link before </body>
  const pixel = `<img src="${BASE_URL}/api/email/track/open?id=${encodeURIComponent(trackingId)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;

  // Build unsubscribe URL: custom URL if set, otherwise default tracking endpoint
  const defaultUnsubUrl = `${BASE_URL}/api/email/unsubscribe?id=${encodeURIComponent(trackingId)}`;
  const customUrl = options?.unsubscribeUrl;
  // If custom URL is set, append tracking id as query param so we can still track
  const unsubUrl = customUrl
    ? `${BASE_URL}/api/email/track/click?id=${encodeURIComponent(trackingId)}&url=${encodeURIComponent(customUrl)}&unsub=1`
    : defaultUnsubUrl;

  const unsubText = options?.unsubscribeText || "Non vuoi pi\u00f9 ricevere queste email? Disiscriviti";

  const unsubLink = `<div style="text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid #e8e8e8;font-size:11px;color:#8a8f96;line-height:1.6;">
  <p style="margin:0 0 8px 0;">Ricevi questa email perch\u00e9 sei iscritto a CitationRate.<br/>
  Questa comunicazione ha finalit\u00e0 informative e di marketing relative ai servizi di AI Visibility.</p>
  <p style="margin:0 0 8px 0;">
    <a href="${unsubUrl}" style="color:#8a8f96;text-decoration:underline;">${unsubText}</a>
  </p>
  <p style="margin:0;font-size:10px;color:#b0b5bc;">
    CitationRate &middot; AI Visibility Platform<br/>
    I tuoi dati sono trattati ai sensi del GDPR (Reg. UE 2016/679).<br/>
    <a href="https://www.citationrate.com/privacy" style="color:#b0b5bc;">Privacy Policy</a> &middot;
    <a href="https://www.citationrate.com/terms" style="color:#b0b5bc;">Termini di Servizio</a>
  </p>
</div>`;

  if (result.includes("</body>")) {
    result = result.replace("</body>", `${unsubLink}\n${pixel}\n</body>`);
  } else {
    result += unsubLink + pixel;
  }

  return result;
}
