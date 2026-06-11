import { NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/webhooks/alert-email";
import { sendD4CS } from "@/lib/email/lifecycle/send-d4";

/**
 * POST /api/webhooks/send-d4
 *
 * Called by the Python backend when a CS audit completes.
 * Auth: x-webhook-secret header (same as other Supabase webhooks).
 *
 * Body: { type: "D4_CS", userId, auditId, brand, scores }
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, userId, auditId, brand, scores } = body;

    if (type === "D4_CS") {
      if (!userId || !auditId || !brand) {
        return NextResponse.json({ error: "Missing userId, auditId, or brand" }, { status: 400 });
      }
      const result = await sendD4CS({ userId, auditId, brand, scores: scores || {} });
      return NextResponse.json({ ok: result.ok, skipped: result.skipped, error: result.error });
    }

    return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
  } catch (err: any) {
    console.error("[send-d4] unhandled error:", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
