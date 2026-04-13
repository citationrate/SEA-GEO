"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { createClient as createAuthClient } from "@/lib/supabase/client";

const COOKIE_KEY = "cookie_consent";
const COOKIE_DOMAIN = ".citationrate.com";
const CR_BACKEND =
  process.env.NEXT_PUBLIC_CR_BACKEND_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "https://citationrate-backend-production.up.railway.app");

interface CookiePrefs {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

function setCrossDomainCookie(prefs: CookiePrefs) {
  const val = encodeURIComponent(JSON.stringify(prefs));
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  const isProduction = window.location.hostname.endsWith("citationrate.com");
  const domain = isProduction ? `; domain=${COOKIE_DOMAIN}` : "";
  document.cookie = `${COOKIE_KEY}=${val}; path=/; expires=${expires}${domain}; SameSite=Lax${isProduction ? "; Secure" : ""}`;
}

function readCrossDomainCookie(): CookiePrefs | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export default function CookieBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = readCrossDomainCookie();
    if (!existing) {
      setVisible(true);
    }
  }, []);

  const save = async (prefs: CookiePrefs) => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs));
    setCrossDomainCookie(prefs);
    setVisible(false);

    try {
      const sb = createAuthClient();
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        await fetch(`${CR_BACKEND}/consent/cookies`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(prefs),
        });
      }
    } catch {
      // Silent — localStorage is the primary store
    }

    window.location.reload();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-border backdrop-blur-xl"
      style={{ background: "var(--surface)" }}
    >
      <div className="max-w-[960px] mx-auto px-6 py-5">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">
              {t("cookie.bannerTitle")}
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {t("cookie.bannerDesc")}{" "}
              <a
                href="https://suite.citationrate.com/legal/avi/cookies"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                {t("legal.cookies")}
              </a>
            </p>
          </div>

          {showDetail && (
            <div className="flex flex-col gap-2.5 pt-2">
              <label className="flex items-center gap-2.5">
                <input type="checkbox" checked disabled className="accent-primary" />
                <div>
                  <span className="text-[13px] font-medium text-foreground">{t("cookie.necessary")}</span>
                  <p className="text-xs text-muted-foreground m-0">{t("cookie.necessaryDesc")}</p>
                </div>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} className="accent-primary" />
                <div>
                  <span className="text-[13px] font-medium text-foreground">{t("cookie.analytics")}</span>
                  <p className="text-xs text-muted-foreground m-0">{t("cookie.analyticsDesc")}</p>
                </div>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} className="accent-primary" />
                <div>
                  <span className="text-[13px] font-medium text-foreground">{t("cookie.marketing")}</span>
                  <p className="text-xs text-muted-foreground m-0">{t("cookie.marketingDesc")}</p>
                </div>
              </label>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {showDetail ? (
              <button
                onClick={() => save({ necessary: true, analytics, marketing })}
                className="px-5 py-2.5 bg-primary text-primary-foreground text-[13px] font-semibold rounded-[2px] hover:bg-primary/80 transition-colors"
              >
                {t("cookie.save")}
              </button>
            ) : (
              <>
                <button
                  onClick={() => save({ necessary: true, analytics: true, marketing: true })}
                  className="px-5 py-2.5 bg-primary text-primary-foreground text-[13px] font-semibold rounded-[2px] hover:bg-primary/80 transition-colors"
                >
                  {t("cookie.acceptAll")}
                </button>
                <button
                  onClick={() => save({ necessary: true, analytics: false, marketing: false })}
                  className="px-5 py-2.5 bg-transparent text-foreground border border-border text-[13px] font-medium rounded-[2px] hover:bg-white/5 transition-colors"
                >
                  {t("cookie.necessaryOnly")}
                </button>
                <button
                  onClick={() => setShowDetail(true)}
                  className="px-3 py-2.5 bg-transparent text-muted-foreground text-[13px] underline hover:text-foreground transition-colors"
                >
                  {t("cookie.customize")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
