"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Plus, Save, Loader2, Users, Trash2, X,
  ToggleLeft, ToggleRight, Eye, Sparkles,
} from "lucide-react";

/* ─── Types ─── */
interface PersonaAttributes {
  sesso?: string;
  eta?: string[];
  zona?: string[];
  occupazione?: string[];
  titolo_studio?: string;
  reddito?: string;
  interessi?: string[];
  valori?: string[];
  stile_vita?: string[];
  fase_acquisto?: string;
  expertise?: string;
  frequenza_acquisto?: string;
}

interface Segment {
  id: string;
  project_id: string;
  name: string;
  label: string;
  prompt_context: string;
  is_active: boolean;
  persona_attributes: PersonaAttributes;
  created_at: string;
}

/* ─── Chip Options ─── */
const SESSO_OPTIONS = ["Maschile", "Femminile", "Non specificato"];
const ETA_OPTIONS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const ZONA_OPTIONS = ["Nord Italia", "Centro Italia", "Sud Italia", "Italia intera", "Europa", "Globale"];
const OCCUPAZIONE_OPTIONS = ["Dipendente", "Libero Professionista", "Imprenditore", "Manager", "Studente", "Pensionato"];
const TITOLO_OPTIONS = ["Licenza Media", "Diploma", "Laurea", "Post-Laurea"];
const REDDITO_OPTIONS = ["< 1.500\u20AC", "1.500-3.000\u20AC", "3.000-5.000\u20AC", "> 5.000\u20AC"];
const INTERESSI_OPTIONS = ["Sport", "Tecnologia", "Finanza", "Salute", "Viaggi", "Moda", "Casa", "Famiglia", "Automotive", "Gaming", "Arte", "Alimentazione"];
const VALORI_OPTIONS = ["Risparmio", "Qualit\u00E0", "Sostenibilit\u00E0", "Innovazione", "Tradizione", "Comodit\u00E0", "Status"];
const STILE_OPTIONS = ["Molto attivo", "Attivo", "Sedentario", "Digitale", "Ibrido"];
const FASE_OPTIONS = ["Sta esplorando", "Sta comparando", "Pronto ad acquistare"];
const EXPERTISE_OPTIONS = ["Novizio", "Base", "Intermedio", "Avanzato", "Esperto"];
const FREQUENZA_OPTIONS = ["Prima volta", "Occasionale", "Abituale", "Brand loyal"];

/* ─── Template Personas ─── */
const TEMPLATES: { emoji: string; label: string; description: string; attrs: PersonaAttributes }[] = [
  {
    emoji: "\uD83E\uDDD1\u200D\uD83D\uDCBC", label: "Professionista Urbano",
    description: "30-44 anni, dipendente/manager, reddito medio-alto, Nord Italia, tech e finanza",
    attrs: { sesso: "Maschile", eta: ["30-44"], zona: ["Nord Italia"], occupazione: ["Dipendente", "Manager"], reddito: "3.000-5.000\u20AC", interessi: ["Tecnologia", "Finanza"], valori: ["Qualit\u00E0", "Innovazione"], fase_acquisto: "Sta comparando" },
  },
  {
    emoji: "\uD83D\uDC74", label: "Pensionato Attivo",
    description: "55-65+ anni, pensionato, reddito basso, Centro/Sud, salute e famiglia",
    attrs: { sesso: "Maschile", eta: ["55-64", "65+"], zona: ["Centro Italia", "Sud Italia"], occupazione: ["Pensionato"], reddito: "< 1.500\u20AC", interessi: ["Salute", "Famiglia"], valori: ["Tradizione", "Risparmio"], fase_acquisto: "Sta esplorando" },
  },
  {
    emoji: "\uD83C\uDF93", label: "Giovane Professionista",
    description: "Donna 25-34, libera professionista, viaggi e moda, sostenibilit\u00E0",
    attrs: { sesso: "Femminile", eta: ["25-34"], zona: ["Italia intera"], occupazione: ["Libero Professionista"], titolo_studio: "Laurea", reddito: "1.500-3.000\u20AC", interessi: ["Viaggi", "Moda"], valori: ["Sostenibilit\u00E0"], frequenza_acquisto: "Prima volta" },
  },
  {
    emoji: "\uD83D\uDC69\u200D\uD83D\uDC67", label: "Genitore Pratico",
    description: "Donna 35-44, dipendente, Sud Italia, casa e famiglia, risparmio",
    attrs: { sesso: "Femminile", eta: ["35-44"], zona: ["Sud Italia"], occupazione: ["Dipendente"], reddito: "1.500-3.000\u20AC", interessi: ["Casa", "Famiglia"], valori: ["Risparmio", "Comodit\u00E0"], fase_acquisto: "Pronto ad acquistare" },
  },
  {
    emoji: "\uD83D\uDE80", label: "Imprenditore Digitale",
    description: "Uomo 30-44, imprenditore, reddito alto, tech e automotive, innovazione",
    attrs: { sesso: "Maschile", eta: ["30-44"], zona: ["Nord Italia"], occupazione: ["Imprenditore"], reddito: "> 5.000\u20AC", interessi: ["Tecnologia", "Automotive"], valori: ["Innovazione", "Status"], expertise: "Esperto" },
  },
  {
    emoji: "\uD83C\uDFAE", label: "Giovane Studente",
    description: "18-24, studente, gaming e tech, risparmio, occasionale",
    attrs: { eta: ["18-24"], occupazione: ["Studente"], reddito: "< 1.500\u20AC", zona: ["Italia intera"], interessi: ["Gaming", "Tecnologia"], valori: ["Risparmio"], frequenza_acquisto: "Occasionale" },
  },
  {
    emoji: "\uD83C\uDFE5", label: "Professionista Sanitario",
    description: "Donna 35-54, dipendente, laurea, salute e formazione, qualit\u00E0",
    attrs: { sesso: "Femminile", eta: ["35-44", "45-54"], zona: ["Italia intera"], occupazione: ["Dipendente"], titolo_studio: "Laurea", reddito: "3.000-5.000\u20AC", interessi: ["Salute"], valori: ["Qualit\u00E0"], expertise: "Intermedio" },
  },
  {
    emoji: "\uD83C\uDFE1", label: "Artigiano Tradizionale",
    description: "Uomo 45-54, libero professionista, diploma, Centro Italia, tradizione",
    attrs: { sesso: "Maschile", eta: ["45-54"], zona: ["Centro Italia"], occupazione: ["Libero Professionista"], titolo_studio: "Diploma", reddito: "1.500-3.000\u20AC", interessi: ["Casa", "Alimentazione"], valori: ["Tradizione", "Qualit\u00E0"], frequenza_acquisto: "Abituale" },
  },
];

/* ─── Prompt generation ─── */
function generatePrompt(name: string, a: PersonaAttributes): string {
  const parts: string[] = [];

  const sessoLabel = a.sesso === "Maschile" ? "un uomo" : a.sesso === "Femminile" ? "una donna" : null;
  const etaStr = a.eta?.length ? `di ${a.eta.join("/")} anni` : null;

  if (sessoLabel && etaStr) parts.push(`Sono ${sessoLabel} ${etaStr}`);
  else if (sessoLabel) parts.push(`Sono ${sessoLabel}`);
  else if (etaStr) parts.push(`Ho ${a.eta!.join("/")} anni`);

  if (a.occupazione?.length) parts.push(`lavoro come ${a.occupazione.join("/").toLowerCase()}`);
  if (a.titolo_studio) parts.push(`con titolo di studio: ${a.titolo_studio.toLowerCase()}`);
  if (a.reddito) parts.push(`con un reddito ${a.reddito}`);
  if (a.zona?.length) parts.push(`e vivo in ${a.zona.join(", ")}`);
  if (a.interessi?.length) parts.push(`Mi interessano ${a.interessi.join(", ").toLowerCase()}`);
  if (a.valori?.length) parts.push(`do valore a ${a.valori.join(", ").toLowerCase()}`);
  if (a.stile_vita?.length) parts.push(`il mio stile di vita \u00E8 ${a.stile_vita.join(", ").toLowerCase()}`);
  if (a.fase_acquisto) parts.push(`${a.fase_acquisto === "Pronto ad acquistare" ? "Sono pronto ad acquistare" : a.fase_acquisto === "Sta comparando" ? "Sto comparando diverse opzioni" : "Sto esplorando le possibilit\u00E0"}`);
  if (a.expertise) parts.push(`il mio livello di expertise nel settore \u00E8 ${a.expertise.toLowerCase()}`);
  if (a.frequenza_acquisto) parts.push(`la mia frequenza di acquisto \u00E8: ${a.frequenza_acquisto.toLowerCase()}`);

  if (parts.length === 0) return "";
  return parts.join(". ").replace(/\.\./g, ".") + ".";
}

/* ─── Main Page ─── */
export default function SegmentsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchSegments = useCallback(async () => {
    const res = await fetch(`/api/segments?project_id=${projectId}`);
    if (res.ok) setSegments(await res.json());
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchSegments(); }, [fetchSegments]);

  async function addFromTemplate(tpl: typeof TEMPLATES[number]) {
    setSaving("template");
    setError("");
    try {
      const prompt = generatePrompt(tpl.label, tpl.attrs);
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          name: tpl.label.toLowerCase().replace(/\s+/g, "_"),
          label: tpl.label,
          prompt_context: prompt,
          is_active: true,
          persona_attributes: tpl.attrs,
        }),
      });
      if (!res.ok) throw new Error();
      await fetchSegments();
    } catch {
      setError("Errore durante la creazione");
    } finally {
      setSaving(null);
    }
  }

  async function toggleActive(seg: Segment) {
    setSaving(seg.id);
    try {
      const res = await fetch("/api/segments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: seg.id, is_active: !seg.is_active }),
      });
      if (!res.ok) throw new Error();
      setSegments((prev) => prev.map((s) => s.id === seg.id ? { ...s, is_active: !s.is_active } : s));
    } catch {
      setError("Errore durante l'aggiornamento");
    } finally {
      setSaving(null);
    }
  }

  async function deleteSegment(id: string) {
    setSaving(id);
    try {
      const res = await fetch(`/api/segments?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSegments((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Errore durante l'eliminazione");
    } finally {
      setSaving(null);
    }
  }

  function summarizeAttrs(a: PersonaAttributes | undefined): string {
    if (!a) return "";
    const bits: string[] = [];
    if (a.sesso) bits.push(a.sesso);
    if (a.eta?.length) bits.push(a.eta.join(", "));
    if (a.zona?.length) bits.push(a.zona.join(", "));
    if (a.occupazione?.length) bits.push(a.occupazione.join(", "));
    if (a.reddito) bits.push(a.reddito);
    return bits.join(" \u2022 ");
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <a href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Torna al progetto
        </a>
        <h1 className="font-display font-bold text-2xl text-foreground">Personas Audience</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configura i profili utente per personalizzare i prompt AI
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* SECTION A: Templates */}
      <section>
        <h2 className="font-display font-semibold text-lg text-foreground mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Template Preimpostati
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Aggiungi una persona con un click, oppure crea la tua da zero.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TEMPLATES.map((tpl) => (
            <div key={tpl.label} className="card p-4 flex flex-col gap-2 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{tpl.emoji}</span>
                <h3 className="font-display font-semibold text-sm text-foreground leading-tight">{tpl.label}</h3>
              </div>
              <p className="text-xs text-muted-foreground flex-1">{tpl.description}</p>
              <button
                onClick={() => addFromTemplate(tpl)}
                disabled={saving === "template"}
                className="mt-1 text-xs font-semibold text-primary hover:text-primary/70 transition-colors self-start flex items-center gap-1"
              >
                {saving === "template" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Usa questo
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION B: My Personas */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-lg text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> I Miei Personas
          </h2>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/85 transition-colors"
          >
            <Plus className="w-4 h-4" /> Crea Persona Custom
          </button>
        </div>

        {loading ? (
          <div className="card flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : segments.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Nessuna persona configurata</p>
            <p className="text-xs text-muted-foreground mt-1">Usa un template sopra o crea un persona custom</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {segments.map((seg) => (
              <div key={seg.id}
                className={`card p-4 flex flex-col gap-2 transition-opacity ${!seg.is_active ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-sm text-foreground">{seg.label}</h3>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleActive(seg)} disabled={saving === seg.id}
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      {saving === seg.id ? <Loader2 className="w-5 h-5 animate-spin" /> :
                        seg.is_active ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => deleteSegment(seg.id)} disabled={saving === seg.id}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {summarizeAttrs(seg.persona_attributes)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Drawer */}
      {drawerOpen && (
        <PersonaDrawer
          projectId={projectId}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => { setDrawerOpen(false); fetchSegments(); }}
        />
      )}
    </div>
  );
}

/* ─── Chip Component ─── */
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
        active
          ? "border-primary text-primary bg-primary/10"
          : "border-border text-muted-foreground bg-transparent hover:border-muted-foreground/40"
      }`}
    >
      {label}
    </button>
  );
}

/* ─── Section label ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-5 mb-2">{children}</h4>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-foreground mb-1.5">{children}</p>;
}

/* ─── Persona Builder Drawer ─── */
function PersonaDrawer({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [attrs, setAttrs] = useState<PersonaAttributes>({});
  const [customZona, setCustomZona] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Single-select helpers
  function setSingle(key: keyof PersonaAttributes, val: string) {
    setAttrs((prev) => ({ ...prev, [key]: prev[key] === val ? undefined : val }));
  }

  // Multi-select helpers
  function toggleMulti(key: keyof PersonaAttributes, val: string) {
    setAttrs((prev) => {
      const arr = (prev[key] as string[] | undefined) ?? [];
      return { ...prev, [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] };
    });
  }

  function addCustomZona() {
    const z = customZona.trim();
    if (!z) return;
    toggleMulti("zona", z);
    setCustomZona("");
  }

  const prompt = useMemo(() => generatePrompt(name, attrs), [name, attrs]);

  async function handleSave() {
    if (!name.trim()) return;
    const finalPrompt = prompt || `Persona: ${name}`;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          name: name.toLowerCase().replace(/\s+/g, "_"),
          label: name.trim(),
          prompt_context: finalPrompt,
          is_active: true,
          persona_attributes: attrs,
        }),
      });
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      setError("Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-[hsl(var(--surface))] border-l border-border z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-display font-bold text-lg text-foreground">Crea Persona</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {/* Name */}
          <FieldLabel>Nome persona *</FieldLabel>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Manager Milanese"
            className="input-base"
          />

          {/* DEMOGRAFICHE */}
          <SectionLabel>Demografiche</SectionLabel>

          <FieldLabel>Sesso</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {SESSO_OPTIONS.map((o) => (
              <Chip key={o} label={o} active={attrs.sesso === o} onClick={() => setSingle("sesso", o)} />
            ))}
          </div>

          <FieldLabel>Et\u00E0</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {ETA_OPTIONS.map((o) => (
              <Chip key={o} label={o} active={attrs.eta?.includes(o) ?? false} onClick={() => toggleMulti("eta", o)} />
            ))}
          </div>

          <FieldLabel>Zona</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {ZONA_OPTIONS.map((o) => (
              <Chip key={o} label={o} active={attrs.zona?.includes(o) ?? false} onClick={() => toggleMulti("zona", o)} />
            ))}
            {(attrs.zona ?? []).filter((z) => !ZONA_OPTIONS.includes(z)).map((z) => (
              <Chip key={z} label={z} active={true} onClick={() => toggleMulti("zona", z)} />
            ))}
          </div>
          <div className="flex gap-1.5 mt-1">
            <input
              type="text"
              value={customZona}
              onChange={(e) => setCustomZona(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomZona())}
              placeholder="Zona custom..."
              className="input-base flex-1 !py-1.5 !text-xs"
            />
            <button onClick={addCustomZona}
              className="text-xs text-primary hover:text-primary/70 transition-colors font-medium px-2">
              Aggiungi
            </button>
          </div>

          <FieldLabel>Occupazione</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {OCCUPAZIONE_OPTIONS.map((o) => (
              <Chip key={o} label={o} active={attrs.occupazione?.includes(o) ?? false} onClick={() => toggleMulti("occupazione", o)} />
            ))}
          </div>

          <FieldLabel>Titolo di studio</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {TITOLO_OPTIONS.map((o) => (
              <Chip key={o} label={o} active={attrs.titolo_studio === o} onClick={() => setSingle("titolo_studio", o)} />
            ))}
          </div>

          <FieldLabel>Reddito</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {REDDITO_OPTIONS.map((o) => (
              <Chip key={o} label={o} active={attrs.reddito === o} onClick={() => setSingle("reddito", o)} />
            ))}
          </div>

          {/* PSICOGRAFICHE */}
          <SectionLabel>Psicografiche</SectionLabel>

          <FieldLabel>Interessi</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {INTERESSI_OPTIONS.map((o) => (
              <Chip key={o} label={o} active={attrs.interessi?.includes(o) ?? false} onClick={() => toggleMulti("interessi", o)} />
            ))}
          </div>

          <FieldLabel>Valori</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {VALORI_OPTIONS.map((o) => (
              <Chip key={o} label={o} active={attrs.valori?.includes(o) ?? false} onClick={() => toggleMulti("valori", o)} />
            ))}
          </div>

          <FieldLabel>Stile di vita</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {STILE_OPTIONS.map((o) => (
              <Chip key={o} label={o} active={attrs.stile_vita?.includes(o) ?? false} onClick={() => toggleMulti("stile_vita", o)} />
            ))}
          </div>

          {/* COMPORTAMENTALI */}
          <SectionLabel>Comportamentali</SectionLabel>

          <FieldLabel>Fase acquisto</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {FASE_OPTIONS.map((o) => (
              <Chip key={o} label={o} active={attrs.fase_acquisto === o} onClick={() => setSingle("fase_acquisto", o)} />
            ))}
          </div>

          <FieldLabel>Expertise settore</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {EXPERTISE_OPTIONS.map((o) => (
              <Chip key={o} label={o} active={attrs.expertise === o} onClick={() => setSingle("expertise", o)} />
            ))}
          </div>

          <FieldLabel>Frequenza acquisto</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {FREQUENZA_OPTIONS.map((o) => (
              <Chip key={o} label={o} active={attrs.frequenza_acquisto === o} onClick={() => setSingle("frequenza_acquisto", o)} />
            ))}
          </div>

          {/* ANTEPRIMA PROMPT */}
          <SectionLabel>Anteprima Prompt</SectionLabel>
          <div className="card p-3 border-primary/20">
            <div className="flex items-center gap-1.5 mb-2">
              <Eye className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">Preview</span>
            </div>
            <p className="text-sm text-foreground/80 italic leading-relaxed">
              {prompt || "Seleziona gli attributi per generare l'anteprima del prompt"}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salva Persona
          </button>
        </div>
      </div>
    </>
  );
}
