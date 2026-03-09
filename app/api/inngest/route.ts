import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { runAnalysis } from "@/lib/inngest-functions";

console.log("Inngest route loaded, functions:", [runAnalysis.id]);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runAnalysis],
  serveHost: process.env.NEXT_PUBLIC_APP_URL || "https://sea-geo-made-by-claude.vercel.app",
});
