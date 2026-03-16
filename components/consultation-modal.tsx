"use client";

import { useState, useEffect } from "react";
import { X, Loader2, CheckCircle, Send } from "lucide-react";
import { useConsultation } from "@/lib/consultation-context";

const OBIETTIVI = [
  { value: "Capire il mio AVI Score", desc: "Non so come interpretare il punteggio ricevuto" },
  { value: "Migliorare la visibilit\u00E0 AI del mio brand", desc: "Voglio sapere cosa fare per salire nelle risposte AI" },
  { value: "Analizzare i miei competitor AI", desc: "Voglio capire perch\u00E9 i competitor appaiono pi\u00F9 spesso di me" },
  { value: "Impostare una strategia di AI Visibility", desc: "Voglio un piano d\u2019azione prioritizzato" },
  { value: "Demo e onboarding guidato", desc: "Voglio capire come usare SeaGeo al meglio" },
  { value: "Altro", desc: "Descrivi la tua esigenza nelle note in fondo" },
];

const GESTIONE = [
  "Io direttamente",
  "Il mio team marketing interno",
  "Un\u2019agenzia o consulente esterno",
  "Non ancora definito",
];

const SETTORI = [
  "Salute e Professioni Sanitarie",
  "Studi Legali Fiscali e Tecnici",
  "Banche Finanza e Assicurazioni",
  "Istruzione e Accademia",
  "Retail e Vendita Online",
  "Software Digital Tech e Academy Online",
  "Industria Manifattura e Logistica",
  "Ristorazione Food e Beverage",
  "Ospitalit\u00E0 e Servizi Turistici",
  "Immobiliare e Sviluppo Edilizio",
  "Servizi Locali Beauty e Artigianato",
  "News Editoria e Portali",
  "Marketing Comunicazione e Business Services",
  "Media Eventi e Intrattenimento",
  "Attrazioni Cultura e Sociale",
];

const DISPONIBILITA = [
  "Lun\u2013Mer / mattina 9:00\u201312:00",
  "Lun\u2013Mer / pomeriggio 14:00\u201318:00",
  "Gio\u2013Ven / mattina 9:00\u201312:00",
  "Gio\u2013Ven / pomeriggio 14:00\u201318:00",
];

export function ConsultationModal() {
  const { open, closeModal } = useConsultation();

  const [nome, setNome] = useState("");
  const [azienda, setAzienda] = useState("");
  const [email, setEmail] = useState("");
  const [urls, setUrls] = useState("");
  const [obiettivo, setObiettivo] = useState("");
  const [datiNonChiari, setDatiNonChiari] = useState("");
  const [gestione, setGestione] = useState("");
  const [settore, setSettore] = useState("");
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
    if (!settore) e.add("settore");
    if (disponibilita.length === 0) e.add("disponibilita");
    setErrors(e);
    return e.size === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setApiError("");
    try {
      const res = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          azienda: azienda.trim(),
          email: email.trim(),
          urls: urls.trim(),
          obiettivo,
          dati_non_chiari: datiNonChiari.trim() || undefined,
          gestione,
          settore,
          disponibilita,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore nell'invio");
      }
      setSubmitted(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Errore nell'invio. Riprova.");
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
          <h2 className="font-display text-xl font-semibold text-foreground">Richiesta inviata</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Il team SeaGeo ti contatter&agrave; entro 24 ore per confermare l&apos;orario della chiamata.
          </p>
          <button onClick={closeModal} className="bg-primary text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors">
            Chiudi
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
            <h2 className="font-display text-xl font-semibold text-foreground">Richiedi consulenza</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Compila il form e ti contatteremo entro 24h</p>
          </div>
          <button onClick={closeModal} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* SECTION 1 — Informazioni */}
          <Section title="1. Informazioni">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nome e cognome *" error={hasErr("nome")}>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Marco Rossi" className={inputCls(hasErr("nome"))} />
              </Field>
              <Field label="Azienda *" error={hasErr("azienda")}>
                <input type="text" value={azienda} onChange={(e) => setAzienda(e.target.value)} placeholder="Es. Ferrero S.p.A." className={inputCls(hasErr("azienda"))} />
              </Field>
            </div>
            <Field label="Email *" error={hasErr("email")}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="marco.rossi@azienda.com" className={inputCls(hasErr("email"))} />
            </Field>
          </Section>

          {/* SECTION 2 — Brand / Progetto */}
          <Section title="2. Brand / Progetto">
            <Field label="URL del sito o brand da analizzare *" error={hasErr("urls")}>
              <textarea value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="Es. https://www.ferrero.com" rows={3} className={inputCls(hasErr("urls"))} />
              <p className="text-[11px] text-muted-foreground mt-1">Puoi inserire fino a 5 URL, uno per riga.</p>
            </Field>
          </Section>

          {/* SECTION 3 — Obiettivo */}
          <Section title="3. Obiettivo *">
            {hasErr("obiettivo") && <p className="text-xs text-destructive mb-1">Seleziona un obiettivo</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OBIETTIVI.map((o) => (
                <RadioCard key={o.value} selected={obiettivo === o.value} onClick={() => setObiettivo(o.value)} label={o.value} desc={o.desc} error={hasErr("obiettivo")} />
              ))}
            </div>
          </Section>

          {/* SECTION 4 — Cosa non è chiaro */}
          <Section title="4. Cosa non &egrave; chiaro">
            <p className="text-xs text-muted-foreground mb-1.5">C&apos;&egrave; un dato o una metrica di SeaGeo che non riesci a interpretare?</p>
            <textarea value={datiNonChiari} onChange={(e) => setDatiNonChiari(e.target.value)} placeholder="Es. Il mio AVI &egrave; 43 ma non capisco quale componente devo migliorare prima. Oppure: i competitor hanno score pi&ugrave; alti ma non so perch&eacute;." rows={3} className="input-base w-full" />
            <p className="text-[11px] text-muted-foreground mt-1">Non servono termini tecnici — descrivi con parole tue.</p>
          </Section>

          {/* SECTION 5 — Gestione */}
          <Section title="5. Chi gestisce la presenza AI del brand *">
            {hasErr("gestione") && <p className="text-xs text-destructive mb-1">Seleziona un&apos;opzione</p>}
            <div className="grid grid-cols-2 gap-2">
              {GESTIONE.map((g) => (
                <RadioCard key={g} selected={gestione === g} onClick={() => setGestione(g)} label={g} error={hasErr("gestione")} />
              ))}
            </div>
          </Section>

          {/* SECTION 6 — Settore */}
          <Section title="6. Settore *">
            {hasErr("settore") && <p className="text-xs text-destructive mb-1">Seleziona un settore</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {SETTORI.map((s) => (
                <RadioCard key={s} selected={settore === s} onClick={() => setSettore(s)} label={s} error={hasErr("settore")} />
              ))}
            </div>
          </Section>

          {/* SECTION 7 — Disponibilità */}
          <Section title="7. Disponibilit&agrave; *">
            {hasErr("disponibilita") && <p className="text-xs text-destructive mb-1">Seleziona almeno una fascia oraria</p>}
            <div className="grid grid-cols-2 gap-2">
              {DISPONIBILITA.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDisp(d)}
                  className={`text-left px-3 py-2.5 rounded-[2px] border text-sm transition-all ${
                    disponibilita.includes(d)
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : hasErr("disponibilita")
                        ? "border-destructive/40 text-muted-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Il team ti contatter&agrave; per confermare l&apos;orario esatto.</p>
          </Section>

          {/* SECTION 8 — Note */}
          <Section title="8. Note aggiuntive">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hai domande specifiche sull'AVI, sui competitor scoperti, o sui modelli AI usati? Scrivi qui qualsiasi contesto utile." rows={4} className="input-base w-full" style={{ minHeight: 120 }} />
          </Section>

          {/* Errors & Submit */}
          {errors.size > 0 && (
            <p className="text-sm text-destructive font-medium">Compila tutti i campi obbligatori per inviare la richiesta.</p>
          )}
          {apiError && <p className="text-sm text-destructive">{apiError}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? "Invio in corso..." : "Invia richiesta"}
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
      <h3 className="text-sm font-semibold text-foreground" dangerouslySetInnerHTML={{ __html: title }} />
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
