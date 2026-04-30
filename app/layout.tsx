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

const CookieBanner = dynamic(
  () => import("@/components/cookie-banner"),
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
      "facebook-domain-verification": "ig2spsymlvf7f1th6hj2uymffhxs3z",
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
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('seageo-theme');
            if (t === 'light') document.documentElement.classList.add('light');
          } catch(e) {}
        `}} />
      </head>
      <body className={`${cormorant.variable} ${syne.variable} ${dmMono.variable} font-sans antialiased`}>
        <LanguageProvider>
        <ConsultationProvider>
        {children}
        <ConsultationModal />
        <CursorFollower />
        <CookieBanner />
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
