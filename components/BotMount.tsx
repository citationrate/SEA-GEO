import Script from "next/script";

import {
  aviBotIdForPlan,
  botWidgetSrc,
  type AviContext,
} from "@/lib/bot-context";
import type { EffectivePlan } from "@/lib/utils/is-pro";

/**
 * Renders the Kore chatbot widget script with the given context.
 *
 * Caller is responsible for:
 *   - confirming the user owns the underlying analysis
 *   - resolving the user's plan and locale
 *   - building the per-route context
 *
 * Returns null (no DOM) when the plan does not get a bot. This keeps the
 * mount sites declarative — every page that wants the bot just renders
 * <BotMount ... /> and trusts the gating logic.
 */
export function BotMount({
  plan,
  context,
}: {
  plan: EffectivePlan;
  context: AviContext;
}) {
  const botId = aviBotIdForPlan(plan);
  if (!botId) return null;

  return (
    <Script
      src={botWidgetSrc(botId)}
      data-context={JSON.stringify(context)}
      strategy="afterInteractive"
    />
  );
}
