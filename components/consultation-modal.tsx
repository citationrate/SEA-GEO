"use client";

import { useState, useEffect } from "react";
import { X, Loader2, CheckCircle, Send } from "lucide-react";
import { useConsultation } from "@/lib/consultation-context";
import { useTranslation } from "@/lib/i18n/context";

export function ConsultationModal() {
  const { open, closeModal } = useConsultation();
  const { t } = useTranslation();

  const OBIETTIVI = [
    { value: "obj1", label: t("consultation.obj1"), desc: t("consultation.obj1Desc") },
    { value: "obj2", label: t("consultation.obj2"), desc: t("consultation.obj2Desc") },
    { value: "obj3", label: t("consultation.obj3"), desc: t("consultation.obj3Desc") },
    { value: "obj4", label: t("consultation.obj4"), desc: t("consultation.obj4Desc") },
    { value: "obj5", label: t("consultation.obj5"), desc: t("consultation.obj5Desc") },
    { value: "obj6", label: t("consultation.obj6"), desc: t("consultation.obj6Desc") },
  ];

  const GESTIONE = [
    { value: "mgmt1", label: t("consultation.mgmt1") },
    { value: "mgmt2", label: t("consultation.mgmt2") },
    { value: "mgmt3", label: t("consultation.mgmt3") },
    { value: "mgmt4", label: t("consultation.mgmt4") },
    { value: "altro", label: t("consultation.mgmt5") },
  ];

  const SETTORI = [
    { value: "sect1", label: t("consultation.sect1") },
    { value: "sect2", label: t("consultation.sect2") },
    { value: "sect3", label: t("consultation.sect3") },
    { value: "sect4", label: t("consultation.sect4") },
    { value: "sect5", label: t("consultation.sect5") },
    { value: "sect6", label: t("consultation.sect6") },
    { value: "sect7", label: t("consultation.sect7") },
    { value: "sect8", label: t("consultation.sect8") },
    { value: "sect9", label: t("consultation.sect9") },
    { value: "sect10", label: t("consultation.sect10") },
    { value: "sect11", label: t("consultation.sect11") },
    { value: "sect12", label: t("consultation.sect12") },
    { value: "sect13", label: t("consultation.sect13") },
    { value: "sect14", label: t("consultation.sect14") },
    { value: "sect15", label: t("consultation.sect15") },
    { value: "altro", label: t("consultation.sect16") },
  ];

  const DISPONIBILITA = [
    { value: "avail1", label: t("consultation.avail1") },
    { value: "avail2", label: t("consultation.avail2") },
    { value: "avail3", label: t("consultation.avail3") },
    { value: "avail4", label: t("consultation.avail4") },
  ];

  const [nome, setNome] = useState("");
  const [azienda, setAzienda] = useState("");
  const [email, setEmail] = useState("");
  const [urls, setUrls] = useState("");
  const [obiettivo, setObiettivo] = useState("");
  const [datiNonChiari, setDatiNonChiari] = useState("");
  const [gestione, setGestione] = useState("");
  const [gestioneAltro, setGestioneAltro] = useState("");
  const [settore, setSettore] = useState("");
  const [settoreAltro, setSettoreAltro] = useState("");
  const [disponibilita, setDisponibilita] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState("");

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") closeModal(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSubmitted(false);
      setApiError("");
      setErrors(new Set());
    }
  }, [open]);

  if (!open) return null;

  function toggleDisp(val: string) {
    setDisponibilita((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);
  }

  function validate(): boolean {
    const e = new Set<string>();
    if (!nome.trim()) e.add("nome");
    if (!azienda.trim()) e.add("azienda");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.add("email");
    if (!urls.trim()) e.add("urls");
    if (!obiettivo) e.add("obiettivo");
    if (!gestione) e.add("gestione");
    if (gestione === "altro" && !gestioneAltro.trim()) e.add("gestioneAltro");
    if (!settore) e.add("settore");
    if (settore === "altro" && !settoreAltro.trim()) e.add("settoreAltro");
    if (disponibilita.length === 0) e.add("disponibilita");
    setErrors(e);
    return e.size === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setApiError("");
    try {
      const gestioneLabel = GESTIONE.find((g) => g.value === gestione)?.label ?? gestione;
      const settoreLabel = SETTORI.find((s) => s.value === settore)?.label ?? settore;
      const obiettivoLabel = OBIETTIVI.find((o) => o.value === obiettivo)?.label ?? obiettivo;
      const dispLabels = disponibilita.map((d) => DISPONIBILITA.find((x) => x.value === d)?.label ?? d);

      const res = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          azienda: azienda.trim(),
          email: email.trim(),
          urls: urls.trim(),
          obiettivo: obiettivoLabel,
          dati_non_chiari: datiNonChiari.trim() || undefined,
          gestione: gestione === "altro" ? `Altro: ${gestioneAltro.trim()}` : gestioneLabel,
          settore: settore === "altro" ? `Altro: ${settoreAltro.trim()}` : settoreLabel,
          disponibilita: dispLabels,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("consultation.sendError"));
      }
      setSubmitted(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : t("consultation.sendErrorRetry"));
    } finally {
      setSubmitting(false);
    }
  }

  const hasErr = (k: string) => errors.has(k);

  // Success state
  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
        <div className="relative bg-surface border border-border rounded-[2px] w-full max-w-md p-8 text-center space-y-4 shadow-2xl animate-fade-in">
          <CheckCircle className="w-12 h-12 text-primary mx-auto" />
          <h2 className="font-display text-xl font-semibold text-foreground">{t("consultation.successTitle")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("consultation.successDesc")}
          </p>
          <button onClick={closeModal} className="bg-primary text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors">
            {t("consultation.close")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
      <div
        className="relative bg-surface border border-border rounded-[2px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">{t("consultation.title")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("consultation.subtitle")}</p>
          </div>
          <button onClick={closeModal} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* SECTION 1 — Informazioni */}
          <Section title={t("consultation.sectionInfo")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("consultation.nameLabel")} error={hasErr("nome")}>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("consultation.namePlaceholder")} className={inputCls(hasErr("nome"))} />
              </Field>
              <Field label={t("consultation.companyLabel")} error={hasErr("azienda")}>
                <input type="text" value={azienda} onChange={(e) => setAzienda(e.target.value)} placeholder={t("consultation.companyPlaceholder")} className={inputCls(hasErr("azienda"))} />
              </Field>
            </div>
            <Field label={t("consultation.emailLabel")} error={hasErr("email")}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("consultation.emailPlaceholder")} className={inputCls(hasErr("email"))} />
            </Field>
          </Section>

          {/* SECTION 2 — Brand / Progetto */}
          <Section title={t("consultation.sectionBrand")}>
            <Field label={t("consultation.urlLabel")} error={hasErr("urls")}>
              <textarea value={urls} onChange={(e) => setUrls(e.target.value)} placeholder={t("consultation.urlPlaceholder")} rows={3} className={inputCls(hasErr("urls"))} />
              <p className="text-[11px] text-muted-foreground mt-1">{t("consultation.urlHelper")}</p>
            </Field>
          </Section>

          {/* SECTION 3 — Obiettivo */}
          <Section title={t("consultation.sectionObjective")}>
            {hasErr("obiettivo") && <p className="text-xs text-destructive mb-1">{t("consultation.selectObjective")}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OBIETTIVI.map((o) => (
                <RadioCard key={o.value} selected={obiettivo === o.value} onClick={() => setObiettivo(o.value)} label={o.label} desc={o.desc} error={hasErr("obiettivo")} />
              ))}
            </div>
          </Section>

          {/* SECTION 4 — Cosa non è chiaro */}
          <Section title={t("consultation.sectionUnclear")}>
            <p className="text-xs text-muted-foreground mb-1.5">{t("consultation.unclearDesc")}</p>
            <textarea value={datiNonChiari} onChange={(e) => setDatiNonChiari(e.target.value)} placeholder={t("consultation.unclearPlaceholder")} rows={3} className="input-base w-full" />
            <p className="text-[11px] text-muted-foreground mt-1">{t("consultation.unclearHelper")}</p>
          </Section>

          {/* SECTION 5 — Gestione */}
          <Section title={t("consultation.sectionManagement")}>
            {hasErr("gestione") && <p className="text-xs text-destructive mb-1">{t("consultation.selectOption")}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GESTIONE.map((g) => (
                <RadioCard key={g.value} selected={gestione === g.value} onClick={() => setGestione(g.value)} label={g.label} error={hasErr("gestione")} />
              ))}
            </div>
            {gestione === "altro" && (
              <input type="text" value={gestioneAltro} onChange={(e) => setGestioneAltro(e.target.value)} placeholder={t("consultation.managementOtherPlaceholder")} className={inputCls(hasErr("gestioneAltro"))} />
            )}
          </Section>

          {/* SECTION 6 — Settore */}
          <Section title={t("consultation.sectionSector")}>
            {hasErr("settore") && <p className="text-xs text-destructive mb-1">{t("consultation.selectSector")}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {SETTORI.map((s) => (
                <RadioCard key={s.value} selected={settore === s.value} onClick={() => setSettore(s.value)} label={s.label} error={hasErr("settore")} />
              ))}
            </div>
            {settore === "altro" && (
              <input type="text" value={settoreAltro} onChange={(e) => setSettoreAltro(e.target.value)} placeholder={t("consultation.sectorOtherPlaceholder")} className={inputCls(hasErr("settoreAltro"))} />
            )}
          </Section>

          {/* SECTION 7 — Disponibilità */}
          <Section title={t("consultation.sectionAvailability")}>
            {hasErr("disponibilita") && <p className="text-xs text-destructive mb-1">{t("consultation.selectTimeSlot")}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DISPONIBILITA.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDisp(d.value)}
                  className={`text-left px-3 py-2.5 rounded-[2px] border text-sm transition-all ${
                    disponibilita.includes(d.value)
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : hasErr("disponibilita")
                        ? "border-destructive/40 text-muted-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{t("consultation.availabilityHelper")}</p>
          </Section>

          {/* SECTION 8 — Note */}
          <Section title={t("consultation.sectionNotes")}>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("consultation.notesPlaceholder")} rows={4} className="input-base w-full" style={{ minHeight: 120 }} />
          </Section>

          {/* Errors & Submit */}
          {errors.size > 0 && (
            <p className="text-sm text-destructive font-medium">{t("consultation.fillRequired")}</p>
          )}
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? t("consultation.sending") : t("consultation.sendRequest")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 pt-4 border-t border-border first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className={`text-xs font-medium ${error ? "text-destructive" : "text-muted-foreground"}`}>{label}</label>
      {children}
    </div>
  );
}

function RadioCard({ selected, onClick, label, desc, error }: { selected: boolean; onClick: () => void; label: string; desc?: string; error?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-3 py-2.5 rounded-[2px] border transition-all ${
        selected
          ? "border-primary bg-primary/10"
          : error
            ? "border-destructive/40"
            : "border-border hover:border-foreground/30"
      }`}
    >
      <p className={`text-sm font-medium ${selected ? "text-primary" : "text-foreground"}`}>{label}</p>
      {desc && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>}
    </button>
  );
}

function inputCls(error: boolean): string {
  return `input-base w-full ${error ? "!border-destructive" : ""}`;
}
