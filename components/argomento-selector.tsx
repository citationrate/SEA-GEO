"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Bookmark, Plus } from "lucide-react";

interface Argomento {
  id: string;
  name: string;
}

interface Props {
  argomenti: Argomento[];
  projectId: string;
  onSelect?: (argomentoId: string) => void;
  onCreateNew?: () => void;
}

const LS_PREFIX = "selectedArgomentoId:";

export function ArgomentoSelector({ argomenti, projectId, onSelect, onCreateNew }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramId = searchParams.get("argomentoId");
  const lsKey = `${LS_PREFIX}${projectId}`;

  const [selected, setSelected] = useState<string>(paramId ?? "");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(lsKey) : null;
    const initial = paramId
      ?? (stored && argomenti.some((a) => a.id === stored) ? stored : null)
      ?? argomenti[0]?.id
      ?? "";
    if (initial && initial !== paramId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("argomentoId", initial);
      router.replace(`${pathname}?${params.toString()}`);
    }
    if (initial && typeof window !== "undefined") {
      localStorage.setItem(lsKey, initial);
    }
    setSelected(initial);
    if (initial && onSelect) onSelect(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleChange = useCallback((value: string) => {
    if (value === "__new__") {
      onCreateNew?.();
      return;
    }
    setSelected(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(lsKey, value);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("argomentoId", value);
    router.push(`${pathname}?${params.toString()}`);
    onSelect?.(value);
  }, [lsKey, pathname, router, searchParams, onSelect, onCreateNew]);

  if (!argomenti.length) return null;

  return (
    <div className="flex items-center gap-2">
      <Bookmark className="w-4 h-4 text-muted-foreground" />
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-muted border border-border rounded-[2px] px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
      >
        {argomenti.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
        <option value="__new__">+ Nuovo argomento</option>
      </select>
    </div>
  );
}
