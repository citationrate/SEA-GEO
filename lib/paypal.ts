/**
 * PayPal API helper — subscriptions and one-time orders.
 *
 * Uses PayPal REST API v2.
 * Sandbox vs Production controlled by PAYPAL_MODE env var:
 *   - "live" → https://api-m.paypal.com
 *   - anything else (default) → https://api-m.sandbox.paypal.com
 *
 * Set PAYPAL_MODE=live on Vercel when switching to production credentials.
 */

const PAYPAL_BASE_URL =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

/* ─── Access Token ─── */

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET");
  }

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // refresh 60s early
  };
  return data.access_token;
}

/* ─── Subscriptions ─── */

export async function createSubscription(
  planId: string,
  userId: string,
  userEmail: string,
) {
  const token = await getAccessToken();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://avi.citationrate.com";

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      plan_id: planId,
      subscriber: {
        email_address: userEmail,
      },
      custom_id: userId, // stored by PayPal, returned in webhooks
      application_context: {
        brand_name: "CitationRate",
        locale: "it-IT",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${appUrl}/payment/success?type=subscription`,
        cancel_url: `${appUrl}/payment/cancel`,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal createSubscription failed (${res.status}): ${text}`);
  }

  const subscription = await res.json();
  const approvalLink = subscription.links?.find(
    (l: { rel: string }) => l.rel === "approve",
  );

  return {
    subscriptionId: subscription.id as string,
    approvalUrl: approvalLink?.href as string,
    status: subscription.status as string,
  };
}

export async function cancelSubscription(
  subscriptionId: string,
  reason = "Cancellato dall'utente",
) {
  const token = await getAccessToken();

  const res = await fetch(
    `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    },
  );

  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`PayPal cancelSubscription failed (${res.status}): ${text}`);
  }

  return { ok: true };
}

export async function getSubscriptionDetails(subscriptionId: string) {
  const token = await getAccessToken();

  const res = await fetch(
    `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal getSubscription failed (${res.status}): ${text}`);
  }

  return res.json();
}

/* ─── One-Time Orders (packages) ─── */

export async function createOrder(
  amount: number,
  currency: string,
  description: string,
  userId: string,
) {
  const token = await getAccessToken();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://avi.citationrate.com";

  const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
          description,
          custom_id: userId,
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "CitationRate AVI",
            locale: "it-IT",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${appUrl}/payment/success?type=package`,
            cancel_url: `${appUrl}/payment/cancel`,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal createOrder failed (${res.status}): ${text}`);
  }

  const order = await res.json();
  const approvalLink = order.links?.find(
    (l: { rel: string }) => l.rel === "payer-action",
  );

  return {
    orderId: order.id as string,
    approvalUrl: approvalLink?.href as string,
    status: order.status as string,
  };
}

export async function captureOrder(orderId: string) {
  const token = await getAccessToken();

  const res = await fetch(
    `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal captureOrder failed (${res.status}): ${text}`);
  }

  return res.json();
}

/* ─── Webhook Verification ─── */

export async function verifyWebhookSignature(
  headers: Record<string, string>,
  body: string,
): Promise<boolean> {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      console.error("[paypal] Missing PAYPAL_WEBHOOK_ID");
      return false;
    }

    const token = await getAccessToken();

    const res = await fetch(
      `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: headers["paypal-auth-algo"],
          cert_url: headers["paypal-cert-url"],
          transmission_id: headers["paypal-transmission-id"],
          transmission_sig: headers["paypal-transmission-sig"],
          transmission_time: headers["paypal-transmission-time"],
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        }),
      },
    );

    if (!res.ok) {
      console.error("[paypal] Webhook verification request failed:", res.status);
      return false;
    }

    const data = await res.json();
    return data.verification_status === "SUCCESS";
  } catch (err) {
    console.error("[paypal] Webhook verification error:", err);
    return false;
  }
}

/* ─── Plan Mapping ─── */

export const PLAN_MAP: Record<string, string> = {
  [process.env.PAYPAL_PLAN_BASE_MONTHLY ?? "__base_m"]: "base",
  [process.env.PAYPAL_PLAN_BASE_ANNUAL ?? "__base_a"]: "base",
  [process.env.PAYPAL_PLAN_PRO_MONTHLY ?? "__pro_m"]: "pro",
  [process.env.PAYPAL_PLAN_PRO_ANNUAL ?? "__pro_a"]: "pro",
};

export function getBillingCycleFromPlanId(planId: string): "monthly" | "annual" {
  if (
    planId === process.env.PAYPAL_PLAN_BASE_ANNUAL ||
    planId === process.env.PAYPAL_PLAN_PRO_ANNUAL
  ) {
    return "annual";
  }
  return "monthly";
}
