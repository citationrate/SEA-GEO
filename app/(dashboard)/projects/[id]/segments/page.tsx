"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Plus, Save, Loader2, Users, Trash2, X,
  ToggleLeft, ToggleRight, Eye, Sparkles, Building2, User,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

/* ─── Types ─── */
interface PersonaAttributes {
  mode?: "b2c" | "b2b";
  // B2C
  sesso?: string;
  eta?: string[];
  zona?: string[];
  occupazione?: string[];
  titolo_studio?: string;
  reddito?: string;
  interessi?: string[];
  valori?: string[];
  stile_vita?: string[];
  // B2B
  ruolo?: string;
  seniority?: string;
  zona_operativa?: string[];
  tipo_azienda?: string[];
  n_dipendenti?: string;
  settore_operativo?: string[];
  interessi_professionali?: string[];
  valori_aziendali?: string[];
  obiettivi?: string[];
  sfide?: string[];
  budget?: string;
  processo_decisionale?: string;
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

/* ═══════ B2C OPTIONS ═══════ */
const SESSO_OPTIONS = ["Maschile", "Femminile", "Non specificato"];
const ETA_OPTIONS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const ZONA_B2C_OPTIONS = ["Nord Italia", "Centro Italia", "Sud Italia", "Italia intera", "Europa", "Globale"];
const OCCUPAZIONE_OPTIONS = ["Dipendente", "Libero Professionista", "Imprenditore", "Manager", "Studente", "Pensionato"];
const TITOLO_OPTIONS = ["Tutti i livelli", "Scuola Secondaria", "Diploma", "Laurea Triennale", "Master / Dottorato"];
const REDDITO_OPTIONS = ["< 1.500\u20AC", "1.500-3.000\u20AC", "3.000-5.000\u20AC", "> 5.000\u20AC"];
const INTERESSI_B2C = ["Sport", "Tecnologia", "Finanza", "Salute", "Viaggi", "Moda", "Casa", "Famiglia", "Automotive", "Gaming", "Arte", "Alimentazione"];
const VALORI_B2C = ["Risparmio", "Qualit\u00E0", "Sostenibilit\u00E0", "Innovazione", "Tradizione", "Comodit\u00E0", "Status"];
const STILE_OPTIONS = ["Molto attivo", "Attivo", "Sedentario", "Digitale", "Ibrido"];

/* ═══════ B2B OPTIONS ═══════ */
const RUOLO_OPTIONS = ["CEO / Fondatore", "Direttore Marketing", "Direttore Commerciale", "CFO / Direttore Finanziario", "CTO / Direttore IT", "HR Manager", "Responsabile Acquisti", "Project Manager", "Consulente", "Responsabile Operativo"];
const SENIORITY_OPTIONS = ["C-Level / Executive", "Director / VP", "Manager", "Senior Specialist", "Specialist / Analyst", "Junior"];
const ZONA_B2B_OPTIONS = ["Nord Italia", "Centro Italia", "Sud Italia", "Italia intera", "Europa", "Nord America", "APAC", "Globale"];
const TIPO_AZIENDA_OPTIONS = ["Startup", "PMI (< 50 dip.)", "Media impresa (50-250)", "Grande impresa (250+)", "Multinazionale", "Studio professionale", "Ente pubblico / PA", "No-profit / ONG"];
const N_DIPENDENTI_OPTIONS = ["1-10", "11-50", "51-200", "201-500", "501-1.000", "1.000+"];
const SETTORE_B2B_OPTIONS = ["Tecnologia / SaaS", "Manifattura", "Servizi finanziari", "Consulenza", "Sanit\u00E0", "Retail / E-commerce", "Logistica / Supply chain", "Energia", "Edilizia / Immobiliare", "Media / Editoria", "Formazione / Education", "Food & Beverage", "Turismo / Hospitality", "Legal / Compliance"];
const INTERESSI_B2B = ["Digital Transformation", "AI / Machine Learning", "Cybersecurity", "Cloud / Infrastruttura", "Marketing Digitale", "Sales Enablement", "Customer Experience", "ESG / Sostenibilit\u00E0", "Data Analytics", "Automazione processi"];
const VALORI_B2B = ["ROI misurabile", "Affidabilit\u00E0", "Innovazione", "Compliance", "Scalabilit\u00E0", "Time to market", "Partnership a lungo termine", "Sicurezza dati"];
const OBIETTIVI_OPTIONS = ["Ridurre i costi", "Aumentare i ricavi", "Migliorare l'efficienza", "Espandere il mercato", "Acquisire nuovi clienti", "Fidelizzare i clienti", "Digitalizzare i processi", "Migliorare la brand reputation"];
const SFIDE_OPTIONS = ["Budget limitato", "Resistenza al cambiamento", "Mancanza di competenze interne", "Integrazione con sistemi esistenti", "Time to market troppo lento", "Competizione aggressiva", "Normative e compliance", "Retention del personale"];
const BUDGET_OPTIONS = ["< 10K\u20AC", "10-50K\u20AC", "50-200K\u20AC", "200K-1M\u20AC", "> 1M\u20AC"];
const PROCESSO_OPTIONS = ["Decisione individuale", "Comitato ristretto (2-3 persone)", "Processo strutturato (4+ stakeholder)", "Gara / RFP formale"];

/* ═══════ TEMPLATES ═══════ */
const B2C_TEMPLATES: { emoji: string; label: string; description: string; attrs: PersonaAttributes }[] = [
  { emoji: "\uD83E\uDDD1\u200D\uD83D\uDCBC", label: "Professionista Urbano", description: "30-44 anni, dipendente/manager, reddito medio-alto, tech e finanza", attrs: { mode: "b2c", sesso: "Maschile", eta: ["30-44"], zona: ["Nord Italia"], occupazione: ["Dipendente", "Manager"], reddito: "3.000-5.000\u20AC", interessi: ["Tecnologia", "Finanza"], valori: ["Qualit\u00E0", "Innovazione"] } },
  { emoji: "\uD83C\uDF93", label: "Giovane Professionista", description: "Donna 25-34, libera professionista, viaggi e moda", attrs: { mode: "b2c", sesso: "Femminile", eta: ["25-34"], zona: ["Italia intera"], occupazione: ["Libero Professionista"], reddito: "1.500-3.000\u20AC", interessi: ["Viaggi", "Moda"], valori: ["Sostenibilit\u00E0"] } },
  { emoji: "\uD83D\uDC69\u200D\uD83D\uDC67", label: "Genitore Pratico", description: "Donna 35-44, famiglia, risparmio e comodit\u00E0", attrs: { mode: "b2c", sesso: "Femminile", eta: ["35-44"], zona: ["Sud Italia"], occupazione: ["Dipendente"], reddito: "1.500-3.000\u20AC", interessi: ["Casa", "Famiglia"], valori: ["Risparmio", "Comodit\u00E0"] } },
  { emoji: "\uD83D\uDE80", label: "Imprenditore Digitale", description: "30-44, imprenditore, reddito alto, tech e innovazione", attrs: { mode: "b2c", sesso: "Maschile", eta: ["30-44"], zona: ["Nord Italia"], occupazione: ["Imprenditore"], reddito: "> 5.000\u20AC", interessi: ["Tecnologia", "Automotive"], valori: ["Innovazione", "Status"] } },
  { emoji: "\uD83D\uDC74", label: "Pensionato Attivo", description: "55-65+, salute e famiglia, tradizione", attrs: { mode: "b2c", eta: ["55-64", "65+"], zona: ["Centro Italia", "Sud Italia"], occupazione: ["Pensionato"], reddito: "< 1.500\u20AC", interessi: ["Salute", "Famiglia"], valori: ["Tradizione", "Risparmio"] } },
  { emoji: "\uD83C\uDFAE", label: "Giovane Studente", description: "18-24, studente, gaming e tech, budget", attrs: { mode: "b2c", eta: ["18-24"], occupazione: ["Studente"], reddito: "< 1.500\u20AC", zona: ["Italia intera"], interessi: ["Gaming", "Tecnologia"], valori: ["Risparmio"] } },
];

const B2B_TEMPLATES: { emoji: string; label: string; description: string; attrs: PersonaAttributes }[] = [
  { emoji: "\uD83D\uDC54", label: "CEO / Founder PMI", description: "C-Level, PMI italiana, focus crescita e digitalizzazione", attrs: { mode: "b2b", ruolo: "CEO / Fondatore", seniority: "C-Level / Executive", tipo_azienda: ["PMI (< 50 dip.)"], settore_operativo: ["Tecnologia / SaaS"], obiettivi: ["Aumentare i ricavi", "Digitalizzare i processi"], sfide: ["Budget limitato", "Competizione aggressiva"], valori_aziendali: ["ROI misurabile", "Innovazione"] } },
  { emoji: "\uD83D\uDCCA", label: "Marketing Director", description: "Director, media impresa, digital marketing e brand", attrs: { mode: "b2b", ruolo: "Direttore Marketing", seniority: "Director / VP", tipo_azienda: ["Media impresa (50-250)"], obiettivi: ["Acquisire nuovi clienti", "Migliorare la brand reputation"], interessi_professionali: ["Marketing Digitale", "Customer Experience", "Data Analytics"], valori_aziendali: ["ROI misurabile", "Time to market"] } },
  { emoji: "\uD83D\uDD27", label: "CTO / IT Director", description: "C-Level tech, grande impresa, cloud e sicurezza", attrs: { mode: "b2b", ruolo: "CTO / Direttore IT", seniority: "C-Level / Executive", tipo_azienda: ["Grande impresa (250+)"], interessi_professionali: ["Cloud / Infrastruttura", "Cybersecurity", "AI / Machine Learning"], obiettivi: ["Migliorare l'efficienza", "Digitalizzare i processi"], sfide: ["Integrazione con sistemi esistenti", "Sicurezza dati"], valori_aziendali: ["Sicurezza dati", "Scalabilit\u00E0"] } },
  { emoji: "\uD83D\uDCB0", label: "Responsabile Acquisti", description: "Manager, procurement, focus costi e compliance", attrs: { mode: "b2b", ruolo: "Responsabile Acquisti", seniority: "Manager", tipo_azienda: ["Media impresa (50-250)", "Grande impresa (250+)"], obiettivi: ["Ridurre i costi"], sfide: ["Normative e compliance", "Competizione aggressiva"], processo_decisionale: "Processo strutturato (4+ stakeholder)", valori_aziendali: ["Compliance", "Affidabilit\u00E0"] } },
  { emoji: "\uD83C\uDFE2", label: "HR Manager", description: "Manager HR, retention e employer branding", attrs: { mode: "b2b", ruolo: "HR Manager", seniority: "Manager", obiettivi: ["Fidelizzare i clienti"], sfide: ["Retention del personale", "Mancanza di competenze interne"], interessi_professionali: ["Digital Transformation", "ESG / Sostenibilit\u00E0"], valori_aziendali: ["Partnership a lungo termine"] } },
  { emoji: "\uD83D\uDE80", label: "Startup Founder", description: "Founder, startup early-stage, crescita rapida", attrs: { mode: "b2b", ruolo: "CEO / Fondatore", seniority: "C-Level / Executive", tipo_azienda: ["Startup"], n_dipendenti: "1-10", obiettivi: ["Espandere il mercato", "Acquisire nuovi clienti"], sfide: ["Budget limitato", "Time to market troppo lento"], budget: "< 10K\u20AC", processo_decisionale: "Decisione individuale", valori_aziendali: ["Time to market", "Innovazione"] } },
];

/* ═══════ PROMPT GENERATORS ═══════ */
function generateB2CPrompt(name: string, a: PersonaAttributes): string {
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
  if (parts.length === 0) return "";
  return parts.join(". ").replace(/\.\./g, ".") + ".";
}

function generateB2BPrompt(name: string, a: PersonaAttributes): string {
  const parts: string[] = [];
  if (a.ruolo) parts.push(`Sono ${a.ruolo}`);
  if (a.seniority) parts.push(`livello ${a.seniority}`);
  if (a.tipo_azienda?.length) parts.push(`in un'azienda di tipo ${a.tipo_azienda.join("/")}`);
  if (a.n_dipendenti) parts.push(`con ${a.n_dipendenti} dipendenti`);
  if (a.settore_operativo?.length) parts.push(`nel settore ${a.settore_operativo.join(", ")}`);
  if (a.zona_operativa?.length) parts.push(`con operativit\u00E0 in ${a.zona_operativa.join(", ")}`);
  if (a.obiettivi?.length) parts.push(`I miei obiettivi principali sono: ${a.obiettivi.join(", ").toLowerCase()}`);
  if (a.sfide?.length) parts.push(`Le sfide che affronto: ${a.sfide.join(", ").toLowerCase()}`);
  if (a.budget) parts.push(`con un budget di ${a.budget}`);
  if (a.processo_decisionale) parts.push(`il processo decisionale \u00E8: ${a.processo_decisionale.toLowerCase()}`);
  if (a.interessi_professionali?.length) parts.push(`Mi interessa: ${a.interessi_professionali.join(", ")}`);
  if (a.valori_aziendali?.length) parts.push(`per la mia azienda conta: ${a.valori_aziendali.join(", ").toLowerCase()}`);
  if (parts.length === 0) return "";
  return parts.join(". ").replace(/\.\./g, ".") + ".";
}

function generatePrompt(name: string, a: PersonaAttributes): string {
  return a.mode === "b2b" ? generateB2BPrompt(name, a) : generateB2CPrompt(name, a);
}

function summarizeAttrs(a: PersonaAttributes | undefined): string {
  if (!a) return "";
  if (a.mode === "b2b") {
    const bits: string[] = [];
    if (a.ruolo) bits.push(a.ruolo);
    if (a.seniority) bits.push(a.seniority);
    if (a.tipo_azienda?.length) bits.push(a.tipo_azienda.join(", "));
    if (a.settore_operativo?.length) bits.push(a.settore_operativo[0]);
    return bits.join(" \u2022 ");
  }
  const bits: string[] = [];
  if (a.sesso) bits.push(a.sesso);
  if (a.eta?.length) bits.push(a.eta.join(", "));
  if (a.zona?.length) bits.push(a.zona.join(", "));
  if (a.occupazione?.length) bits.push(a.occupazione.join(", "));
  if (a.reddito) bits.push(a.reddito);
  return bits.join(" \u2022 ");
}

/* ═══════ MAIN PAGE ═══════ */
export default function SegmentsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { t } = useTranslation();

  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<"b2c" | "b2b">("b2c");

  const fetchSegments = useCallback(async () => {
    const res = await fetch(`/api/segments?project_id=${projectId}`);
    if (res.ok) setSegments(await res.json());
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchSegments(); }, [fetchSegments]);

  async function addFromTemplate(tpl: { label: string; attrs: PersonaAttributes }) {
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
      if (!res.ok) throw new Error(t("segments.createError"));
      await fetchSegments();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("segments.createError"));
    } finally {
      setSaving(null);
    }
  }

  async function toggleActive(seg: Segment) {
    setSaving(seg.id);
    try {
      await fetch("/api/segments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: seg.id, is_active: !seg.is_active }) });
      setSegments((prev) => prev.map((s) => s.id === seg.id ? { ...s, is_active: !s.is_active } : s));
    } catch { setError(t("segments.updateError")); }
    finally { setSaving(null); }
  }

  async function deleteSegment(id: string) {
    setSaving(id);
    try { await fetch(`/api/segments?id=${id}`, { method: "DELETE" }); setSegments((prev) => prev.filter((s) => s.id !== id)); }
    catch { setError(t("queries.deleteError")); }
    finally { setSaving(null); }
  }

  const templates = mode === "b2c" ? B2C_TEMPLATES : B2B_TEMPLATES;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <a href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> {t("nav.backToProject")}
        </a>
        <h1 className="font-display font-bold text-2xl text-foreground">{t("segments.title")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("segments.subtitle")}</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* B2C / B2B Switch */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-[2px] border border-border w-fit">
        <button onClick={() => setMode("b2c")} className={`flex items-center gap-2 px-4 py-2 rounded-[2px] text-sm font-semibold transition-all ${mode === "b2c" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <User className="w-4 h-4" /> B2C — Consumatore
        </button>
        <button onClick={() => setMode("b2b")} className={`flex items-center gap-2 px-4 py-2 rounded-[2px] text-sm font-semibold transition-all ${mode === "b2b" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Building2 className="w-4 h-4" /> B2B — Decision Maker
        </button>
      </div>

      {/* Templates */}
      <section>
        <h2 className="font-display font-semibold text-lg text-foreground mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> {t("segments.templates")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((tpl) => (
            <div key={tpl.label} className="card p-4 flex flex-col gap-2 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{tpl.emoji}</span>
                <h3 className="font-display font-semibold text-sm text-foreground leading-tight">{tpl.label}</h3>
              </div>
              <p className="text-xs text-muted-foreground flex-1">{tpl.description}</p>
              <button onClick={() => addFromTemplate(tpl)} disabled={saving === "template"}
                className="mt-1 text-xs font-semibold text-primary hover:text-primary/70 transition-colors self-start flex items-center gap-1">
                {saving === "template" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                {t("segments.useThis")}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* My Personas */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-display font-semibold text-lg text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> {t("segments.myPersonas")}
          </h2>
          <button onClick={() => setDrawerOpen(true)} className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-3 py-1.5 rounded-[2px] hover:bg-primary/85 transition-colors">
            <Plus className="w-4 h-4" /> {t("segments.createCustom")}
          </button>
        </div>
        {loading ? (
          <div className="card flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : segments.length === 0 ? (
          <div className="card flex flex-col items-center py-12 text-center"><Users className="w-10 h-10 text-muted-foreground/40 mb-3" /><p className="text-sm text-muted-foreground">{t("segments.noPersona")}</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {segments.map((seg) => (
              <div key={seg.id} className={`card p-4 flex flex-col gap-2 transition-opacity ${!seg.is_active ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold text-sm text-foreground">{seg.label}</h3>
                    {seg.persona_attributes?.mode === "b2b" && <span className="font-mono text-[0.6rem] text-[#c4a882] border border-[#c4a882]/30 px-1 py-0.5 rounded-[2px]">B2B</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleActive(seg)} disabled={saving === seg.id} className="text-muted-foreground hover:text-foreground transition-colors">
                      {saving === seg.id ? <Loader2 className="w-5 h-5 animate-spin" /> : seg.is_active ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => deleteSegment(seg.id)} disabled={saving === seg.id} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{summarizeAttrs(seg.persona_attributes)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {drawerOpen && <PersonaDrawer projectId={projectId} mode={mode} onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); fetchSegments(); }} />}
    </div>
  );
}

/* ═══════ SHARED COMPONENTS ═══════ */
function Chip({ label, active, custom, onClick }: { label: string; active: boolean; custom?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-1.5 rounded-[2px] text-xs font-medium transition-all ${active ? custom ? "border border-dashed border-primary text-primary bg-primary/15" : "border border-primary text-primary bg-primary/15" : "border border-border text-muted-foreground hover:border-foreground/40"}`}>
      {label}
    </button>
  );
}

function CustomChipInput({ placeholder, onAdd }: { placeholder?: string; onAdd: (val: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-1.5 mt-1.5">
      <input type="text" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (val.trim()) { onAdd(val.trim()); setVal(""); } } }} placeholder={placeholder ?? "Altro..."} className="input-base flex-1 !py-1.5 !text-xs" />
      <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }} className="flex items-center justify-center w-8 h-8 rounded-[2px] border border-primary/40 text-primary hover:bg-primary/10 transition-colors shrink-0"><Plus className="w-4 h-4" /></button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="pt-5 pb-2 border-t border-border mt-5 first:mt-0 first:border-t-0 first:pt-0"><h4 className="text-sm font-semibold uppercase tracking-widest text-primary">{children}</h4></div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-foreground mb-1.5 mt-3">{children}</p>;
}

function ChipField({ label, options, selected, onToggle, onAdd, multi = true }: { label: string; options: string[]; selected: string | string[] | undefined; onToggle: (v: string) => void; onAdd: (v: string) => void; multi?: boolean }) {
  const isActive = (v: string) => multi ? (selected as string[] | undefined)?.includes(v) ?? false : selected === v;
  const customs = multi
    ? ((selected as string[]) ?? []).filter((v) => !options.includes(v))
    : selected && !options.includes(selected as string) ? [selected as string] : [];
  return (
    <>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => <Chip key={o} label={o} active={isActive(o)} onClick={() => onToggle(o)} />)}
        {customs.map((c) => <Chip key={c} label={c} active custom onClick={() => onToggle(c)} />)}
      </div>
      <CustomChipInput placeholder={`Altro ${label.toLowerCase()}...`} onAdd={onAdd} />
    </>
  );
}

/* ═══════ PERSONA DRAWER ═══════ */
function PersonaDrawer({ projectId, mode, onClose, onSaved }: { projectId: string; mode: "b2c" | "b2b"; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [attrs, setAttrs] = useState<PersonaAttributes>({ mode });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  function setSingle(key: keyof PersonaAttributes, val: string) {
    setAttrs((prev) => ({ ...prev, [key]: (prev as any)[key] === val ? undefined : val }));
  }
  function toggleMulti(key: keyof PersonaAttributes, val: string) {
    setAttrs((prev) => {
      const arr = ((prev as any)[key] as string[] | undefined) ?? [];
      return { ...prev, [key]: arr.includes(val) ? arr.filter((v: string) => v !== val) : [...arr, val] };
    });
  }
  function addCustomMulti(key: keyof PersonaAttributes, val: string) { toggleMulti(key, val); }
  function addCustomSingle(key: keyof PersonaAttributes, val: string) { setAttrs((prev) => ({ ...prev, [key]: val })); }

  const prompt = useMemo(() => generatePrompt(name, attrs), [name, attrs]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/segments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, name: name.toLowerCase().replace(/\s+/g, "_"), label: name.trim(), prompt_context: prompt || `Persona: ${name}`, is_active: true, persona_attributes: attrs }),
      });
      if (!res.ok) throw new Error(t("projects.saveError"));
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : t("projects.saveError")); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg border-l border-border z-50 flex flex-col animate-slide-in-right" style={{ background: "var(--ink-2)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-lg text-foreground">{t("segments.createPersona")}</h2>
            <span className={`font-mono text-[0.65rem] px-1.5 py-0.5 rounded-[2px] border ${mode === "b2b" ? "text-[#c4a882] border-[#c4a882]/30" : "text-primary border-primary/30"}`}>{mode.toUpperCase()}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <FieldLabel>{t("segments.personaName")} *</FieldLabel>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={mode === "b2b" ? "Es. Marketing Director PMI" : "Es. Manager Milanese"} className="input-base" />

          {mode === "b2c" ? (
            <>
              <SectionLabel>{t("segments.demographics")}</SectionLabel>
              <ChipField label="Sesso" options={SESSO_OPTIONS} selected={attrs.sesso} onToggle={(v) => setSingle("sesso", v)} onAdd={(v) => addCustomSingle("sesso", v)} multi={false} />
              <ChipField label="Et\u00E0" options={ETA_OPTIONS} selected={attrs.eta} onToggle={(v) => toggleMulti("eta", v)} onAdd={(v) => addCustomMulti("eta", v)} />
              <ChipField label="Zona" options={ZONA_B2C_OPTIONS} selected={attrs.zona} onToggle={(v) => toggleMulti("zona", v)} onAdd={(v) => addCustomMulti("zona", v)} />
              <ChipField label="Occupazione" options={OCCUPAZIONE_OPTIONS} selected={attrs.occupazione} onToggle={(v) => toggleMulti("occupazione", v)} onAdd={(v) => addCustomMulti("occupazione", v)} />
              <ChipField label="Titolo di studio" options={TITOLO_OPTIONS} selected={attrs.titolo_studio} onToggle={(v) => setSingle("titolo_studio", v)} onAdd={(v) => addCustomSingle("titolo_studio", v)} multi={false} />
              <ChipField label="Reddito" options={REDDITO_OPTIONS} selected={attrs.reddito} onToggle={(v) => setSingle("reddito", v)} onAdd={(v) => addCustomSingle("reddito", v)} multi={false} />

              <SectionLabel>{t("segments.psychographics")}</SectionLabel>
              <ChipField label="Interessi" options={INTERESSI_B2C} selected={attrs.interessi} onToggle={(v) => toggleMulti("interessi", v)} onAdd={(v) => addCustomMulti("interessi", v)} />
              <ChipField label="Valori" options={VALORI_B2C} selected={attrs.valori} onToggle={(v) => toggleMulti("valori", v)} onAdd={(v) => addCustomMulti("valori", v)} />
              <ChipField label="Stile di vita" options={STILE_OPTIONS} selected={attrs.stile_vita} onToggle={(v) => toggleMulti("stile_vita", v)} onAdd={(v) => addCustomMulti("stile_vita", v)} />
            </>
          ) : (
            <>
              <SectionLabel>Profilo professionale</SectionLabel>
              <ChipField label="Ruolo" options={RUOLO_OPTIONS} selected={attrs.ruolo} onToggle={(v) => setSingle("ruolo", v)} onAdd={(v) => addCustomSingle("ruolo", v)} multi={false} />
              <ChipField label="Seniority" options={SENIORITY_OPTIONS} selected={attrs.seniority} onToggle={(v) => setSingle("seniority", v)} onAdd={(v) => addCustomSingle("seniority", v)} multi={false} />
              <ChipField label="Zona operativa" options={ZONA_B2B_OPTIONS} selected={attrs.zona_operativa} onToggle={(v) => toggleMulti("zona_operativa", v)} onAdd={(v) => addCustomMulti("zona_operativa", v)} />

              <SectionLabel>Azienda</SectionLabel>
              <ChipField label="Tipo azienda" options={TIPO_AZIENDA_OPTIONS} selected={attrs.tipo_azienda} onToggle={(v) => toggleMulti("tipo_azienda", v)} onAdd={(v) => addCustomMulti("tipo_azienda", v)} />
              <ChipField label="Numero dipendenti" options={N_DIPENDENTI_OPTIONS} selected={attrs.n_dipendenti} onToggle={(v) => setSingle("n_dipendenti", v)} onAdd={(v) => addCustomSingle("n_dipendenti", v)} multi={false} />
              <ChipField label="Settore operativo" options={SETTORE_B2B_OPTIONS} selected={attrs.settore_operativo} onToggle={(v) => toggleMulti("settore_operativo", v)} onAdd={(v) => addCustomMulti("settore_operativo", v)} />

              <SectionLabel>Obiettivi e sfide</SectionLabel>
              <ChipField label="Obiettivi principali" options={OBIETTIVI_OPTIONS} selected={attrs.obiettivi} onToggle={(v) => toggleMulti("obiettivi", v)} onAdd={(v) => addCustomMulti("obiettivi", v)} />
              <ChipField label="Sfide principali" options={SFIDE_OPTIONS} selected={attrs.sfide} onToggle={(v) => toggleMulti("sfide", v)} onAdd={(v) => addCustomMulti("sfide", v)} />
              <ChipField label="Budget disponibile" options={BUDGET_OPTIONS} selected={attrs.budget} onToggle={(v) => setSingle("budget", v)} onAdd={(v) => addCustomSingle("budget", v)} multi={false} />
              <ChipField label="Processo decisionale" options={PROCESSO_OPTIONS} selected={attrs.processo_decisionale} onToggle={(v) => setSingle("processo_decisionale", v)} onAdd={(v) => addCustomSingle("processo_decisionale", v)} multi={false} />

              <SectionLabel>Interessi e valori professionali</SectionLabel>
              <ChipField label="Interessi professionali" options={INTERESSI_B2B} selected={attrs.interessi_professionali} onToggle={(v) => toggleMulti("interessi_professionali", v)} onAdd={(v) => addCustomMulti("interessi_professionali", v)} />
              <ChipField label="Valori aziendali" options={VALORI_B2B} selected={attrs.valori_aziendali} onToggle={(v) => toggleMulti("valori_aziendali", v)} onAdd={(v) => addCustomMulti("valori_aziendali", v)} />
            </>
          )}

          <SectionLabel>{t("segments.promptPreview")}</SectionLabel>
          <div className="card p-4 border-primary/20">
            <div className="flex items-center gap-1.5 mb-2">
              <Eye className="w-3.5 h-3.5 text-primary" />
              <span className="text-[12px] font-semibold uppercase tracking-widest text-primary">Preview</span>
            </div>
            <p className="text-sm text-foreground/80 italic leading-relaxed">{prompt || t("segments.selectForPreview")}</p>
          </div>
        </div>

        <div className="px-5 py-4 pb-6 border-t border-border shrink-0 space-y-2" style={{ background: "var(--ink-2)" }}>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button onClick={handleSave} disabled={saving || !name.trim()} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-3 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("segments.savePersona")}
          </button>
        </div>
      </div>
    </>
  );
}
