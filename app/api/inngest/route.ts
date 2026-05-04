import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { runBrandProfile } from "@/lib/brand-profile/inngest";
import { runAnalysis } from "@/lib/inngest-functions";
import { runCompetitiveAnalysis } from "@/lib/inngest-competitive";

// Inngest steps run as Vercel serverless invocations. Without an explicit
// maxDuration the function inherits Vercel's 60s default — too short for
// reasoning models. With expensive tasks split into a dedicated AI-call step
// and a separate extractor step (see inngest-functions.ts), each step needs
// to comfortably hold one slow call: gpt-5.5-pro at effort=medium is ~2 min,
// claude-opus with web search ~1-2 min. 600s on Vercel Pro gives 3-5x margin
// against runaway calls before the lambda is killed.
export const maxDuration = 600;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runAnalysis, runCompetitiveAnalysis, runBrandProfile],
});
