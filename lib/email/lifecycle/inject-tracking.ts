/**
 * Inject open pixel + click wrapper into email HTML.
 *
 * - Appends a 1x1 tracking pixel before </body>
 * - Wraps all <a href="..."> links through our click tracker
 *   (skips mailto: and unsubscribe links)
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://avi.citationrate.com";

export function injectTracking(html: string, trackingId: string): string {
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
  const unsubLink = `<div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e8e8e8;font-size:11px;color:#8a8f96;">
  <a href="${BASE_URL}/api/email/unsubscribe?id=${encodeURIComponent(trackingId)}" style="color:#8a8f96;text-decoration:underline;">Non vuoi più ricevere queste email? Disiscriviti</a>
</div>`;

  if (result.includes("</body>")) {
    result = result.replace("</body>", `${unsubLink}\n${pixel}\n</body>`);
  } else {
    result += unsubLink + pixel;
  }

  return result;
}
