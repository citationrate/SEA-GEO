import { NextResponse } from "next/server";

// Temporary debug endpoint — remove after testing
export async function GET() {
  return NextResponse.json({
    hasClientId: !!process.env.PAYPAL_CLIENT_ID,
    hasClientSecret: !!process.env.PAYPAL_CLIENT_SECRET,
    hasWebhookId: !!process.env.PAYPAL_WEBHOOK_ID,
    hasPlanBaseMonthly: !!process.env.PAYPAL_PLAN_BASE_MONTHLY,
    hasPlanBaseAnnual: !!process.env.PAYPAL_PLAN_BASE_ANNUAL,
    hasPlanProMonthly: !!process.env.PAYPAL_PLAN_PRO_MONTHLY,
    hasPlanProAnnual: !!process.env.PAYPAL_PLAN_PRO_ANNUAL,
    hasCitationRateKey: !!process.env.CITATIONRATE_SERVICE_ROLE_KEY,
    nodeEnv: process.env.NODE_ENV,
    // Show first/last 4 chars of plan IDs to verify values
    planBaseMonthly: process.env.PAYPAL_PLAN_BASE_MONTHLY
      ? `${process.env.PAYPAL_PLAN_BASE_MONTHLY.slice(0, 4)}...${process.env.PAYPAL_PLAN_BASE_MONTHLY.slice(-4)}`
      : null,
    clientIdPrefix: process.env.PAYPAL_CLIENT_ID?.slice(0, 8) ?? null,
  });
}
