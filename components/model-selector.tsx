"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";

const LS_KEY = "selectedModel";

function ModelSelectorInner({ models }: { models: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramModel = searchParams.get("model");

  const [selected, setSelected] = useState<string>(paramModel ?? "");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    const initial = paramModel
      ?? (stored && (stored === "" || models.includes(stored)) ? stored : "")
    if (initial !== (paramModel ?? "")) {
      const params = new URLSearchParams(searchParams.toString());
      if (initial) {
        params.set("model", initial);
      } else {
        params.delete("model");
      }
      router.replace(`${pathname}?${params.toString()}`);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, initial);
    }
    setSelected(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(model: string) {
    setSelected(model);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, model);
    }
    const params = new URLSearchParams(searchParams.toString());
    if (model) {
      params.set("model", model);
    } else {
      params.delete("model");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  if (models.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Cpu className="w-4 h-4 text-muted-foreground" />
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-muted border border-border rounded-[2px] px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
      >
        <option value="">Tutti i modelli</option>
        {models.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}

export function ModelSelector({ models }: { models: string[] }) {
  return (
    <Suspense fallback={null}>
      <ModelSelectorInner models={models} />
    </Suspense>
  );
}
