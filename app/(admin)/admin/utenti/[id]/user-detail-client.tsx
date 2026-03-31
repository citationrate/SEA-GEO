"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Crown, Loader2, Check, Save, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

interface Props {
  user: { id: string; email: string; full_name: string; plan: string; created_at: string; is_admin: boolean };
  projects: { id: string; name: string; target_brand: string; sector: string | null; created_at: string; runCount: number; lastRun: string | null }[];
  runs: { id: string; project_id: string; status: string; version: number; models_used: string[]; created_at: string; avi_score: number | null }[];
  stats: { totalProjects: number; totalRuns: number; avgAvi: number | null; comparisons: number };
  modelCounts: { model: string; count: number }[];
  aviTrend: { date: string; avi: number; project_id: string }[];
}

export function UserDetailClient({ user, projects, runs, stats, modelCounts, aviTrend }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "avi">("overview");
  const [plan, setPlan] = useState(user.plan);
  const [saving, setSaving] = useState(false);
  const [showDeleteUser, setShowDeleteUser] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingUser, setDeletingUser] = useState(false);
  const [showResetDemo, setShowResetDemo] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);

  async function savePlan() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, plan }),
      });
      if (!res.ok) throw new Error();
      toast.success("Piano aggiornato");
      router.refresh();
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  const StatusIcon = (s: string) => s === "completed" ? CheckCircle : s === "failed" ? XCircle : Clock;

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <a href="/admin/utenti" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Torna agli utenti
      </a>

      {/* Header */}
      <div className="card p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-[2px] flex items-center justify-center text-primary font-display text-xl shrink-0" style={{ background: "var(--primary-glow)" }}>
          {(user.full_name?.[0] ?? user.email?.[0] ?? "U").toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="font-display font-bold text-xl text-foreground">{user.full_name || user.email}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Registrato: {new Date(user.created_at).toLocaleDateString("it-IT")}</p>
        </div>
        <span className={`inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-[2px] border ${
          plan === "pro" ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground"
        }`}>
          {plan === "pro" && <Crown className="w-4 h-4" />}
          {plan === "demo" ? "Demo" : plan === "base" ? "Base" : plan === "pro" ? "Pro" : plan}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 text-center"><p className="font-display font-bold text-lg text-foreground">{stats.totalProjects}</p><p className="text-xs text-muted-foreground">Progetti</p></div>
        <div className="card p-4 text-center"><p className="font-display font-bold text-lg text-foreground">{stats.totalRuns}</p><p className="text-xs text-muted-foreground">Analisi</p></div>
        <div className="card p-4 text-center"><p className="font-display font-bold text-lg text-primary">{stats.avgAvi ?? "—"}</p><p className="text-xs text-muted-foreground">AVI medio</p></div>
        <div className="card p-4 text-center"><p className="font-display font-bold text-lg text-foreground">{stats.comparisons}</p><p className="text-xs text-muted-foreground">Confronti</p></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setTab("overview")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Panoramica</button>
        <button onClick={() => setTab("avi")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "avi" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Dati AVI</button>
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          {/* Plan editor */}
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Modifica piano</h2>
            <div className="flex items-center gap-3">
              {["demo", "base", "pro"].map((p) => (
                <button key={p} onClick={() => setPlan(p)} className={`px-4 py-2 rounded-[2px] border text-sm font-medium transition-colors ${plan === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  {p === "demo" ? "Demo" : p === "base" ? "Base" : "Pro"}
                </button>
              ))}
              <button onClick={savePlan} disabled={saving || plan === user.plan} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Salva
              </button>
            </div>
          </div>

          {/* Reset demo account */}
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#f59e0b]" /> Reset Demo
            </h2>
            <div className="flex items-center justify-between bg-[#f59e0b]/5 rounded-[2px] px-4 py-3 border border-[#f59e0b]/20">
              <div>
                <p className="text-sm text-foreground font-medium">Reset account demo</p>
                <p className="text-xs text-muted-foreground">Cancella tutti i dati e riporta il piano a Pro</p>
              </div>
              <button
                onClick={() => setShowResetDemo(true)}
                className="px-4 py-2 bg-[#f59e0b] text-white rounded-[2px] text-sm font-medium hover:bg-[#f59e0b]/80 transition-colors shrink-0"
              >
                Reset Demo
              </button>
            </div>
          </div>

          {/* Reset demo modal */}
          {showResetDemo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowResetDemo(false)}>
              <div className="bg-ink border border-[#f59e0b]/30 rounded-[3px] p-6 w-[420px] space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
                  <h3 className="text-lg font-medium text-foreground">Reset account demo</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Sei sicuro di voler resettare questo account demo? Verranno eliminati tutti i progetti, analisi, competitor e dati associati. Il piano verrà reimpostato a <strong className="text-foreground">Pro</strong>.
                </p>
                <p className="text-sm text-muted-foreground">
                  L&apos;account di <strong className="text-foreground">{user.email}</strong> rimarrà attivo.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowResetDemo(false)}
                    className="text-sm px-4 py-2 rounded-[2px] border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={async () => {
                      setResettingDemo(true);
                      try {
                        const res = await fetch("/api/admin/reset-demo", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ user_id: user.id }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          toast.success("Account demo resettato con successo");
                          setShowResetDemo(false);
                          router.refresh();
                        } else {
                          toast.error(data.error || "Errore nel reset");
                        }
                      } catch {
                        toast.error("Errore di rete");
                      } finally {
                        setResettingDemo(false);
                      }
                    }}
                    disabled={resettingDemo}
                    className="text-sm px-4 py-2 rounded-[2px] bg-[#f59e0b] text-white hover:bg-[#f59e0b]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {resettingDemo && <Loader2 className="w-4 h-4 animate-spin" />}
                    Conferma reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete user */}
          <div className="card p-5 space-y-3 border-destructive/20">
            <h2 className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Zona pericolosa
            </h2>
            <div className="flex items-center justify-between bg-destructive/5 rounded-[2px] px-4 py-3 border border-destructive/20">
              <div>
                <p className="text-sm text-foreground font-medium">Elimina account utente</p>
                <p className="text-xs text-muted-foreground">Rimuove tutti i dati dell&apos;utente (GDPR hard delete)</p>
              </div>
              <button
                onClick={() => setShowDeleteUser(true)}
                className="px-4 py-2 bg-destructive text-white rounded-[2px] text-sm font-medium hover:bg-destructive/80 transition-colors shrink-0"
              >
                Elimina account
              </button>
            </div>
          </div>

          {/* Delete user modal */}
          {showDeleteUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeleteUser(false)}>
              <div className="bg-ink border border-destructive/30 rounded-[3px] p-6 w-[420px] space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <h3 className="text-lg font-medium text-foreground">Elimina account utente</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Stai per eliminare permanentemente l&apos;account di <strong className="text-foreground">{user.email}</strong> e tutti i dati associati. Questa azione non può essere annullata.
                </p>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Scrivi <strong className="text-foreground">ELIMINA</strong> per confermare
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="ELIMINA"
                    className="w-full px-3 py-2 text-sm rounded-[2px] border border-border bg-ink text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-destructive"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => { setShowDeleteUser(false); setDeleteConfirmText(""); }}
                    className="text-sm px-4 py-2 rounded-[2px] border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={async () => {
                      setDeletingUser(true);
                      try {
                        const res = await fetch("/api/admin/delete-user", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ user_id: user.id }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          toast.success("Account eliminato");
                          router.push("/admin/utenti");
                        } else {
                          toast.error(data.error || "Errore nell'eliminazione");
                        }
                      } catch {
                        toast.error("Errore di rete");
                      } finally {
                        setDeletingUser(false);
                      }
                    }}
                    disabled={deleteConfirmText !== "ELIMINA" || deletingUser}
                    className="text-sm px-4 py-2 rounded-[2px] bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {deletingUser && <Loader2 className="w-4 h-4 animate-spin" />}
                    Elimina definitivamente
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Projects */}
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Progetti ({projects.length})</h2>
            {projects.map((pr) => (
              <div key={pr.id} className="bg-muted/20 rounded-[2px] p-3 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{pr.name}</p>
                    <p className="text-xs text-muted-foreground">{pr.target_brand} {pr.sector ? `· ${pr.sector}` : ""}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{pr.runCount} analisi</span>
                </div>
                {/* Runs for this project */}
                {runs.filter((r) => r.project_id === pr.id).slice(0, 5).map((r) => {
                  const Icon = StatusIcon(r.status);
                  return (
                    <div key={r.id} className="flex items-center gap-3 text-xs pl-3 border-l-2 border-border">
                      <Icon className={`w-3.5 h-3.5 ${r.status === "completed" ? "text-primary" : r.status === "failed" ? "text-destructive" : "text-muted-foreground"}`} />
                      <span className="text-muted-foreground">v{r.version}</span>
                      {r.avi_score != null && <span className="text-primary font-bold">AVI {r.avi_score}</span>}
                      <span className="text-muted-foreground">{r.models_used.join(", ")}</span>
                      <span className="text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleDateString("it-IT")}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "avi" && (
        <div className="space-y-6">
          {aviTrend.length > 0 && (
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Trend AVI</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aviTrend}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9d9890" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9d9890" }} />
                    <Tooltip contentStyle={{ background: "#1a1c1e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, fontSize: 12 }} />
                    <Line type="monotone" dataKey="avi" stroke="#7eb89a" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {modelCounts.length > 0 && (
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Modelli AI utilizzati</h2>
              <div className="space-y-2">
                {modelCounts.map((m) => (
                  <div key={m.model} className="flex items-center gap-3">
                    <span className="text-sm text-foreground w-40 truncate">{m.model}</span>
                    <div className="flex-1 h-2 bg-muted rounded-[2px] overflow-hidden">
                      <div className="h-full bg-primary rounded-[2px]" style={{ width: `${(m.count / modelCounts[0].count) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{m.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
