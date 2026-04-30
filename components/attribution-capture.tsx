"use client";

import { useEffect } from "react";

/**
 * Capture Meta's `fbclid` query param into a `_fbc` cookie on .citationrate.com
 * (90-day TTL). Same logic as suite/aivx-frontend — keeps cross-subdomain
 * attribution intact when an ad lands on landing → suite → avi or vice versa.
 *
 * Cookie format `_fbc`: fb.<subdomain_index>.<unix_ms>.<fbclid>
 * Subdomain index for avi.citationrate.com (3 parts) = 1.
 */
export default function AttributionCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const isProduction = window.location.hostname.endsWith("citationrate.com");
    const domainAttr = isProduction ? "; domain=.citationrate.com" : "";
    const secureAttr = isProduction ? "; Secure" : "";
    const ninetyDays = 90 * 24 * 60 * 60;

    const fbclid = params.get("fbclid");
    if (fbclid) {
      const fbcValue = `fb.1.${Date.now()}.${fbclid}`;
      document.cookie = `_fbc=${encodeURIComponent(fbcValue)}; path=/; max-age=${ninetyDays}${domainAttr}; SameSite=Lax${secureAttr}`;
    }

    const hasFirstTouch = document.cookie.match(/(?:^|; )attribution_first_touch=/);
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
    const utm: Partial<Record<(typeof utmKeys)[number], string>> = {};
    let anyUtm = false;
    for (const k of utmKeys) {
      const v = params.get(k);
      if (v) {
        utm[k] = v;
        anyUtm = true;
      }
    }
    if (anyUtm && !hasFirstTouch) {
      const payload = encodeURIComponent(JSON.stringify({ ...utm, ts: Date.now() }));
      document.cookie = `attribution_first_touch=${payload}; path=/; max-age=${ninetyDays}${domainAttr}; SameSite=Lax${secureAttr}`;
    }
  }, []);

  return null;
}
