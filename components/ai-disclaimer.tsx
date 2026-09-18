import { Info } from "lucide-react";

export default function AIDisclaimer() {
  return (
    <p className="flex items-start gap-2 text-[0.68rem] mt-6" style={{ color: "var(--c-muted)" }}>
      <Info size={13} className="shrink-0 mt-px" />
      <span>Analisi generata con l&apos;ausilio di sistemi di intelligenza artificiale.</span>
    </p>
  );
}
