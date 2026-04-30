import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { runBrandProfile } from "@/lib/brand-profile/inngest";
import { runAnalysis } from "@/lib/inngest-functions";
import { runCompetitiveAnalysis } from "@/lib/inngest-competitive";

// Inngest steps run as Vercel serverless invocations. Without an explicit
// maxDuration the function inherits Vercel's 60s default — which kills any
// step that sequences multiple slow AI calls (e.g. gpt-5.5-pro reasoning,
// claude-opus with web search). On Vercel Pro the cap is 300s; combined with
// expensive-aware batching in inngest-functions.ts, that's enough for any
// single AI call plus the Haiku extractor follow-up.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runAnalysis, runCompetitiveAnalysis, runBrandProfile],
});
