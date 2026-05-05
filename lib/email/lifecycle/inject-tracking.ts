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

  // 2. Append tracking pixel before </body>
  const pixel = `<img src="${BASE_URL}/api/email/track/open?id=${encodeURIComponent(trackingId)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;

  if (result.includes("</body>")) {
    result = result.replace("</body>", `${pixel}\n</body>`);
  } else {
    // Fallback: append at end
    result += pixel;
  }

  return result;
}
