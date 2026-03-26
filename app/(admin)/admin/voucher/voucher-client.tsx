"use client";

import { useEffect, useState, useCallback } from "react";
import { Ticket, Plus, Trash2, Loader2, Check, Copy, RefreshCw } from "lucide-react";

interface Voucher {
  id: string;
  code: string;
  type: string;
  plan: string | null;
  extra_browsing_prompts: number;
  extra_no_browsing_prompts: number;
  extra_comparisons: number;
  reset_usage: boolean;
  description: string | null;
  is_used: boolean;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const TYPES = [
  { value: "plan_upgrade", label: "Upgrade piano" },
  { value: "query_credit", label: "Crediti query" },
  { value: "comparison_credit", label: "Crediti confronti" },
  { value: "usage_reset", label: "Reset utilizzo" },
  { value: "combo", label: "Combo (piano + crediti)" },
];

const PRESETS = [
  { label: "Demo → Base", type: "plan_upgrade", plan: "base", description: "Upgrade a Base" },
  { label: "Demo → Pro", type: "plan_upgrade", plan: "pro", description: "Upgrade a Pro" },
  { label: "+100 query standard", type: "query_credit", extra_no_browsing_prompts: 100, description: "+100 query senza browsing" },
  { label: "+100 query browsing", type: "query_credit", extra_browsing_prompts: 100, description: "+100 query con browsing" },
  { label: "+300 query mix", type: "query_credit", extra_browsing_prompts: 90, extra_no_browsing_prompts: 210, description: "+300 query (90 browsing + 210 standard)" },
  { label: "+5 confronti", type: "comparison_credit", extra_comparisons: 5, description: "+5 confronti competitivi" },
  { label: "Reset contatori", type: "usage_reset", reset_usage: true, description: "Azzera contatori mese" },
  { label: "Pro + reset", type: "combo", plan: "pro", reset_usage: true, description: "Pro + reset contatori" },
];

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AVI-";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function VoucherClient() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState(generateCode);
  const [type, setType] = useState("plan_upgrade");
  const [plan, setPlan] = useState("base");
  const [extraBrowsing, setExtraBrowsing] = useState(0);
  const [extraNoBrowsing, setExtraNoBrowsing] = useState(0);
  const [extraComparisons, setExtraComparisons] = useState(0);
  const [resetUsage, setResetUsage] = useState(false);
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/vouchers");
      const data = await res.json();
      setVouchers(data.vouchers ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  function applyPreset(preset: typeof PRESETS[number]) {
    setType(preset.type);
    setPlan(preset.plan ?? "base");
    setExtraBrowsing((preset as any).extra_browsing_prompts ?? 0);
    setExtraNoBrowsing((preset as any).extra_no_browsing_prompts ?? 0);
    setExtraComparisons((preset as any).extra_comparisons ?? 0);
    setResetUsage((preset as any).reset_usage ?? false);
    setDescription(preset.description);
    setCode(generateCode());
    setShowForm(true);
  }

  async function createVoucher() {
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          type,
          plan: (type === "plan_upgrade" || type === "combo") ? plan : undefined,
          extra_browsing_prompts: extraBrowsing,
          extra_no_browsing_prompts: extraNoBrowsing,
          extra_comparisons: extraComparisons,
          reset_usage: resetUsage,
          description: description || undefined,
          expires_at: expiresAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Errore");
        return;
      }
      setShowForm(false);
      setCode(generateCode());
      setDescription("");
      setExpiresAt("");
      setExtraBrowsing(0);
      setExtraNoBrowsing(0);
      setExtraComparisons(0);
      setResetUsage(false);
      fetchVouchers();
    } catch {
      setFormError("Errore di rete");
    } finally {
      setCreating(false);
    }
  }

  async function deleteVoucher(id: string) {
    await fetch(`/api/admin/vouchers?id=${id}`, { method: "DELETE" });
    setVouchers((prev) => prev.filter((v) => v.id !== id));
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  const unusedCount = vouchers.filter((v) => !v.is_used).length;
  const usedCount = vouchers.filter((v) => v.is_used).length;

  return (
    <div className="space-y-6 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-foreground" style={{ fontWeight: 300 }}>Voucher</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unusedCount} disponibili · {usedCount} utilizzati · {vouchers.length} totali
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchVouchers}
            className="p-2 rounded-[2px] border border-border text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setCode(generateCode()); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-[2px] text-xs font-semibold hover:bg-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuovo voucher
          </button>
        </div>
      </div>

      {/* Quick presets */}
      <div className="card p-4 space-y-3">
        <p className="font-mono text-[0.625rem] uppercase tracking-widest text-muted-foreground">Preset rapidi</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 rounded-[2px] text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-5 space-y-4 border-primary/30">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Crea voucher</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Code */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Codice</label>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="input-base flex-1 font-mono uppercase tracking-wider"
                />
                <button
                  onClick={() => setCode(generateCode())}
                  className="px-2 py-1 border border-border rounded-[2px] text-muted-foreground hover:text-foreground transition-colors"
                  title="Genera nuovo"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Type */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input-base w-full"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Plan (conditional) */}
            {(type === "plan_upgrade" || type === "combo") && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Piano target</label>
                <select value={plan} onChange={(e) => setPlan(e.target.value)} className="input-base w-full">
                  <option value="base">Base</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
            )}

            {/* Browsing prompts */}
            {(type === "query_credit" || type === "combo") && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Query browsing</label>
                <input type="number" min={0} value={extraBrowsing} onChange={(e) => setExtraBrowsing(Number(e.target.value))} className="input-base w-full" />
              </div>
            )}

            {/* No-browsing prompts */}
            {(type === "query_credit" || type === "combo") && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Query standard</label>
                <input type="number" min={0} value={extraNoBrowsing} onChange={(e) => setExtraNoBrowsing(Number(e.target.value))} className="input-base w-full" />
              </div>
            )}

            {/* Comparisons */}
            {(type === "comparison_credit" || type === "combo") && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Confronti extra</label>
                <input type="number" min={0} value={extraComparisons} onChange={(e) => setExtraComparisons(Number(e.target.value))} className="input-base w-full" />
              </div>
            )}

            {/* Reset toggle */}
            {(type === "usage_reset" || type === "combo") && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Reset contatori</label>
                <button
                  onClick={() => setResetUsage(!resetUsage)}
                  className={`px-3 py-2 rounded-[2px] text-xs font-medium border transition-colors w-full ${resetUsage ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground"}`}
                >
                  {resetUsage ? "Attivo" : "Disattivo"}
                </button>
              </div>
            )}

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Descrizione</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="input-base w-full" placeholder="Opzionale" />
            </div>

            {/* Expiry */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Scadenza</label>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="input-base w-full" />
            </div>
          </div>

          {formError && <p className="text-xs text-destructive">{formError}</p>}

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={createVoucher}
              disabled={creating || !code.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-[2px] text-xs font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Crea voucher
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-border text-muted-foreground rounded-[2px] text-xs hover:bg-muted/30 transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Voucher list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Nessun voucher</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-widest text-muted-foreground">Codice</th>
                  <th className="text-left px-3 py-2.5 font-mono text-[0.625rem] uppercase tracking-widest text-muted-foreground">Tipo</th>
                  <th className="text-left px-3 py-2.5 font-mono text-[0.625rem] uppercase tracking-widest text-muted-foreground">Dettagli</th>
                  <th className="text-center px-3 py-2.5 font-mono text-[0.625rem] uppercase tracking-widest text-muted-foreground">Stato</th>
                  <th className="text-right px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => copyCode(v.code)}
                        className="flex items-center gap-1.5 font-mono text-foreground hover:text-primary transition-colors"
                        title="Copia codice"
                      >
                        {v.code}
                        {copied === v.code ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {TYPES.find((t) => t.value === v.type)?.label ?? v.type}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate">
                      {v.description || buildDetail(v)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {v.is_used ? (
                        <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold px-2 py-0.5 rounded-[2px] bg-muted/30 text-muted-foreground">
                          Usato
                        </span>
                      ) : v.expires_at && new Date(v.expires_at) < new Date() ? (
                        <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold px-2 py-0.5 rounded-[2px] bg-destructive/10 text-destructive">
                          Scaduto
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold px-2 py-0.5 rounded-[2px] bg-primary/10 text-primary">
                          Attivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => deleteVoucher(v.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function buildDetail(v: Voucher): string {
  const parts: string[] = [];
  if (v.plan) parts.push(`Piano: ${v.plan}`);
  if (v.extra_browsing_prompts > 0) parts.push(`+${v.extra_browsing_prompts} browsing`);
  if (v.extra_no_browsing_prompts > 0) parts.push(`+${v.extra_no_browsing_prompts} standard`);
  if (v.extra_comparisons > 0) parts.push(`+${v.extra_comparisons} confronti`);
  if (v.reset_usage) parts.push("Reset");
  return parts.join(" · ") || "—";
}
