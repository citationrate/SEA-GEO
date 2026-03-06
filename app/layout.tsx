import type { Metadata } from "next";
import { Outfit, DM_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
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
      <body className={`${outfit.variable} ${dmSans.variable} ${jetbrains.variable} font-sans antialiased`}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(218 20% 9%)",
              border: "1px solid hsl(220 12% 17%)",
              color: "hsl(210 18% 92%)",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
