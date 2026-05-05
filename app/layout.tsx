import type { Metadata } from "next";
import { Cormorant_Garamond, Syne, DM_Mono } from "next/font/google";
import { Toaster } from "sonner";
import dynamic from "next/dynamic";

import { LanguageProvider } from "@/lib/i18n/context";
import { ConsultationProvider } from "@/lib/consultation-context";
import { ConsultationModal } from "@/components/consultation-modal";
import "./globals.css";

const CursorFollower = dynamic(
  () => import("@/components/cursor-follower").then((m) => m.CursorFollower),
  { ssr: false },
);

const AttributionCapture = dynamic(
  () => import("@/components/attribution-capture"),
  { ssr: false },
);

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["300", "400"],
  style: ["normal", "italic"],
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "AVI — AI Visibility Intelligence",
    template: "%s | AVI",
  },
  description:
    "Misura la visibilità del tuo brand nelle risposte AI. Analisi per audience segment, competitor discovery, AVI score.",
  verification: {
    other: {
      "facebook-domain-verification": "8fz20sj9f832kmlxv1qp1bo707vdo3",
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
        <link rel="preconnect" href="https://suite.citationrate.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://suite.citationrate.com" />
        {/* Google Consent Mode v2 defaults — must run BEFORE GTM loads.
            Reads the cross-domain cookie_consent set by CookieAegis on the
            shared .citationrate.com so a user who already consented on suite
            doesn't see the banner again on AVI. */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          var __consent = {analytics:false, marketing:false};
          try {
            var m = document.cookie.match(/(?:^|; )cookie_consent=([^;]*)/);
            if (m) __consent = JSON.parse(decodeURIComponent(m[1]));
          } catch(e){}
          gtag('consent', 'default', {
            ad_storage: __consent.marketing ? 'granted' : 'denied',
            ad_user_data: __consent.marketing ? 'granted' : 'denied',
            ad_personalization: __consent.marketing ? 'granted' : 'denied',
            analytics_storage: __consent.analytics ? 'granted' : 'denied',
            wait_for_update: 500
          });
        `}} />
        {/* Google Tag Manager — loaded on every page, tags gated via Consent Mode v2 */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-N5L5WHTZ');
        `}} />
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('seageo-theme');
            if (t === 'light') document.documentElement.classList.add('light');
          } catch(e) {}
        `}} />
      </head>
      <body className={`${cormorant.variable} ${syne.variable} ${dmMono.variable} font-sans antialiased`}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-N5L5WHTZ"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <LanguageProvider>
        <ConsultationProvider>
        {children}
        <ConsultationModal />
        <CursorFollower />
        <AttributionCapture />
        </ConsultationProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              fontSize: "13px",
              borderRadius: "2px",
            },
          }}
        />
        </LanguageProvider>
      </body>
    </html>
  );
}
