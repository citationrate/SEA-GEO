"use client";

import { AVIRing } from "@/components/dashboard/index";

export function RunAVIRing(props: { score: number | null; trend: number | null; components?: { label: string; v: number | null }[]; noBrandMentions?: boolean }) {
  return <AVIRing {...props} />;
}
