"use client";

import { Crown } from "lucide-react";
import Link from "next/link";

interface ProPaywallModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProPaywallModal({ open, onClose }: ProPaywallModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-ink border border-[#d4a817]/30 rounded-[3px] p-6 w-[400px] space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-[#d4a817]" />
          <h3 className="text-lg font-medium text-foreground">Funzionalità Pro</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Questa funzionalità è disponibile solo nel piano <strong className="text-foreground">Pro</strong>.
          Passa a Pro per accedere a Dataset, Confronto Competitivo e Analisi Contesti AI.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-[2px] border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            Forse dopo
          </button>
          <Link
            href="/piano#piani"
            className="text-sm px-4 py-2 rounded-[2px] bg-[#d4a817] text-white hover:bg-[#d4a817]/90 transition-colors font-medium"
          >
            Scopri il piano Pro &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
