"use client";

import { AVIRing } from "@/components/dashboard/index";

export function RunAVIRing(props: { score: number | null; trend: number | null; noBrandMentions?: boolean }) {
  return <AVIRing score={props.score} trend={props.trend} noBrandMentions={props.noBrandMentions} />;
}
