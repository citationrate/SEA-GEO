import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { runBrandProfile } from "@/lib/brand-profile/inngest";
import { runAnalysis } from "@/lib/inngest-functions";
import { runCompetitiveAnalysis } from "@/lib/inngest-competitive";

// Inngest steps run as Vercel serverless invocations. Without an explicit
// maxDuration the function inherits Vercel's 60s default — too short for
// expensive models. With expensive tasks split into a dedicated AI-call step
// and a separate extractor step (see inngest-functions.ts), each step needs
// to comfortably hold one slow call: claude-opus with web search ~1-2 min.
// 300s is the cap on the current Vercel plan (raising to 600 was rejected
// silently at "Deploying outputs" post-build); split-step memoization absorbs
// anything that overruns.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runAnalysis, runCompetitiveAnalysis, runBrandProfile],
});
