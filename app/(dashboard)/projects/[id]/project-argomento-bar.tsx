"use client";

import { useState, useCallback, Suspense } from "react";
import { ArgomentoSelector } from "@/components/argomento-selector";
import { ArgomentoCreateModal } from "@/components/argomento-create-modal";
import { useRouter } from "next/navigation";

interface Argomento { id: string; name: string }

interface Props {
  projectId: string;
  argomenti: Argomento[];
  children?: React.ReactNode;
}

/**
 * Bar with Argomento selector + Create modal.
 * Wraps around the AnalysisLauncher to pass argomentoId.
 */
export function ProjectArgomentoBar({ projectId, argomenti: initial, children }: Props) {
  const router = useRouter();
  const [argomenti, setArgomenti] = useState<Argomento[]>(initial);
  const [selectedId, setSelectedId] = useState<string>(initial[0]?.id ?? "");
  const [showCreate, setShowCreate] = useState(false);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleCreated = useCallback((a: Argomento) => {
    setArgomenti((prev) => [...prev, a]);
    setSelectedId(a.id);
    router.refresh();
  }, [router]);

  return (
    <>
      <div className="flex items-center gap-2">
        <Suspense fallback={null}>
          <ArgomentoSelector
            argomenti={argomenti}
            projectId={projectId}
            onSelect={handleSelect}
            onCreateNew={() => setShowCreate(true)}
          />
        </Suspense>
        {children}
      </div>
      <ArgomentoCreateModal
        projectId={projectId}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
