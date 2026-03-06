"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Save, Loader2, Users, ToggleLeft, ToggleRight } from "lucide-react";

interface Segment {
  id: string;
  project_id: string;
  name: string;
  label: string;
  prompt_context: string;
  is_active: boolean;
  created_at: string;
}

const DEFAULT_SEGMENTS = [
  { name: "beginner", label: "Beginner", prompt_context: "Utente alle prime armi, cerca informazioni base e guide introduttive." },
  { name: "researcher", label: "Researcher", prompt_context: "Utente che fa ricerca approfondita, confronta opzioni e cerca dati." },
  { name: "professional", label: "Professional", prompt_context: "Professionista del settore, cerca soluzioni avanzate e best practice." },
  { name: "buyer", label: "Buyer", prompt_context: "Utente pronto all'acquisto, cerca prezzi, recensioni e confronti diretti." },
] as const;

export default function SegmentsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

  async function fetchSegments() {
    const res = await fetch(`/api/segments?project_id=${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setSegments(data);
    }
    setLoading(false);
  }

  useEffect(() => { fetchSegments(); }, []);

  async function initDefaults() {
    setCreating(true);
    setError("");
    try {
      for (const seg of DEFAULT_SEGMENTS) {
        await fetch("/api/segments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId, ...seg, is_active: true }),
        });
      }
      await fetchSegments();
    } catch {
      setError("Errore durante la creazione dei segmenti");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(segment: Segment) {
    setSaving(segment.id);
    try {
      const res = await fetch("/api/segments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: segment.id, is_active: !segment.is_active }),
      });
      if (!res.ok) throw new Error();
      setSegments(segments.map((s) => s.id === segment.id ? { ...s, is_active: !s.is_active } : s));
    } catch {
      setError("Errore durante l'aggiornamento");
    } finally {
      setSaving(null);
    }
  }

  async function updatePrompt(segment: Segment, newPrompt: string) {
    setSaving(segment.id);
    try {
      const res = await fetch("/api/segments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: segment.id, prompt_context: newPrompt }),
      });
      if (!res.ok) throw new Error();
      setSegments(segments.map((s) => s.id === segment.id ? { ...s, prompt_context: newPrompt } : s));
    } catch {
      setError("Errore durante l'aggiornamento");
    } finally {
      setSaving(null);
    }
  }

  async function addCustom() {
    if (!customLabel.trim() || !customPrompt.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          name: "custom",
          label: customLabel.trim(),
          prompt_context: customPrompt.trim(),
          is_active: true,
        }),
      });
      if (!res.ok) throw new Error();
      setCustomLabel("");
      setCustomPrompt("");
      setShowCustomForm(false);
      await fetchSegments();
    } catch {
      setError("Errore durante la creazione");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <a
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna al progetto
        </a>
        <h1 className="font-display font-bold text-2xl text-foreground">Segmenti Audience</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configura i profili utente per personalizzare i prompt AI
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="card flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : segments.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Nessun segmento configurato</p>
          <button
            onClick={initDefaults}
            disabled={creating}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crea segmenti default
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {segments.map((seg) => (
            <SegmentCard
              key={seg.id}
              segment={seg}
              saving={saving === seg.id}
              onToggle={() => toggleActive(seg)}
              onSavePrompt={(p) => updatePrompt(seg, p)}
            />
          ))}
        </div>
      )}

      {segments.length > 0 && !showCustomForm && (
        <button
          onClick={() => setShowCustomForm(true)}
          className="flex items-center gap-2 bg-surface border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:border-primary/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Aggiungi segmento custom
        </button>
      )}

      {showCustomForm && (
        <div className="card p-5 space-y-4">
          <h3 className="font-display font-semibold text-foreground">Nuovo segmento custom</h3>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nome</label>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Es. Decision Maker"
              className="input-base"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Prompt context</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Descrivi il profilo utente..."
              rows={3}
              className="input-base resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addCustom}
              disabled={creating || !customLabel.trim() || !customPrompt.trim()}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salva
            </button>
            <button
              onClick={() => { setShowCustomForm(false); setCustomLabel(""); setCustomPrompt(""); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SegmentCard({
  segment,
  saving,
  onToggle,
  onSavePrompt,
}: {
  segment: Segment;
  saving: boolean;
  onToggle: () => void;
  onSavePrompt: (prompt: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(segment.prompt_context);

  return (
    <div className={`card p-5 space-y-3 transition-opacity ${!segment.is_active ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-semibold text-foreground">{segment.label}</h3>
          <span className="badge badge-muted text-[10px]">{segment.name}</span>
        </div>
        <button onClick={onToggle} disabled={saving} className="text-muted-foreground hover:text-foreground transition-colors">
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : segment.is_active ? (
            <ToggleRight className="w-6 h-6 text-primary" />
          ) : (
            <ToggleLeft className="w-6 h-6" />
          )}
        </button>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="input-base resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { onSavePrompt(draft); setEditing(false); }}
              className="text-xs text-primary hover:text-primary/70 transition-colors font-medium"
            >
              Salva
            </button>
            <button
              onClick={() => { setDraft(segment.prompt_context); setEditing(false); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <p
          onClick={() => setEditing(true)}
          className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        >
          {segment.prompt_context}
        </p>
      )}
    </div>
  );
}
