import type { Metadata } from "next";
import { Cormorant_Garamond, Syne, DM_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

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
    default: "SeaGeo — AI Visibility Intelligence",
    template: "%s | SeaGeo",
  },
  description:
    "Misura la visibilità del tuo brand nelle risposte AI. Analisi per audience segment, competitor discovery, AVI score.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('seageo-theme');
            if (t === 'light') document.documentElement.classList.add('light');
          } catch(e) {}
        `}} />
      </head>
      <body className={`${cormorant.variable} ${syne.variable} ${dmMono.variable} font-sans antialiased`}>
        {children}
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
      </body>
    </html>
  );
}
