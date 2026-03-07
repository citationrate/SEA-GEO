import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { runAnalysis } from "@/lib/inngest-functions";

console.log("Inngest route loaded, functions:", [runAnalysis.id]);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runAnalysis],
});
