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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
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
