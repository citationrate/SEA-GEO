import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { runAnalysis } from "@/lib/inngest-functions";
import { runCompetitiveAnalysis } from "@/lib/inngest-competitive";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runAnalysis, runCompetitiveAnalysis],
});
