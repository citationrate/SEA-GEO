"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, FolderOpen, BarChart3, Activity, Crown, Swords, Trophy, TrendingUp, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

const PIE_COLORS = ["#7eb89a", "#c4a882", "#7eb3d4", "#e8956d", "#9d9890"];

const STATUS_CONFIG: Record<string, { icon: any; cls: string }> = {
  completed: { icon: CheckCircle, cls: "text-primary" },
  running: { icon: Loader2, cls: "text-yellow-500 animate-spin" },
  failed: { icon: XCircle, cls: "text-destructive" },
  pending: { icon: Clock, cls: "text-muted-foreground" },
};

interface Props {
  kpi: {
    totalUsers: number;
    activeProjects: number;
    completedAnalyses: number;
    avgAvi: number | null;
    weekAnalyses: number;
    proUsers: number;
    completedComparisons: number;
    distinctCompetitors: number;
  };
  analysesPerDay: { day: string; count: number }[];
  planDistribution: { plan: string; count: number }[];
  topSectors: { sector: string; count: number }[];
  activity: { id: string; status: string; created_at: string; project_name: string; user_email: string; models: string[] }[];
}

export function AdminOverviewClient({ kpi, analysesPerDay, planDistribution, topSectors, activity }: Props) {
  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
      <h1 className="font-display font-bold text-2xl text-foreground">Admin Overview</h1>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Utenti totali" value={kpi.totalUsers} />
        <KpiCard icon={FolderOpen} label="Progetti attivi" value={kpi.activeProjects} />
        <KpiCard icon={BarChart3} label="Analisi completate" value={kpi.completedAnalyses} />
        <KpiCard icon={TrendingUp} label="AVI medio globale" value={kpi.avgAvi != null ? kpi.avgAvi : "—"} highlight />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Activity} label="Analisi questa settimana" value={kpi.weekAnalyses} />
        <KpiCard icon={Crown} label="Utenti Pro" value={kpi.proUsers} />
        <KpiCard icon={Swords} label="Confronti AI completati" value={kpi.completedComparisons} />
        <KpiCard icon={Trophy} label="Competitor scoperti" value={kpi.distinctCompetitors} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Analyses per day */}
        <div className="card p-5 space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Analisi ultimi 30 giorni</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysesPerDay}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9d9890" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "#9d9890" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1a1c1e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, fontSize: 12 }} />
                <Bar dataKey="count" fill="#7eb89a" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan distribution */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Distribuzione piani</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planDistribution} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={70} label={({ plan, count }) => `${plan} (${count})`}>
                  {planDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1c1e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top sectors */}
      {topSectors.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Top 5 settori</h2>
          <div className="space-y-2">
            {topSectors.map((s, i) => (
              <div key={s.sector} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                <div className="flex-1 h-2 bg-muted rounded-[2px] overflow-hidden">
                  <div className="h-full bg-primary rounded-[2px]" style={{ width: `${(s.count / topSectors[0].count) * 100}%` }} />
                </div>
                <span className="text-sm text-foreground w-40 truncate">{s.sector}</span>
                <span className="text-xs text-muted-foreground w-10 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Attivit&agrave; recente</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Stato</th>
                <th className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Progetto</th>
                <th className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Utente</th>
                <th className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Modelli</th>
                <th className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => {
                const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                return (
                  <tr key={a.id} className="border-b border-border/30">
                    <td className="px-3 py-2"><Icon className={`w-4 h-4 ${cfg.cls}`} /></td>
                    <td className="px-3 py-2 text-foreground">{a.project_name}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{a.user_email}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{a.models.join(", ")}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("it-IT")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-[2px] flex items-center justify-center shrink-0 ${highlight ? "bg-primary/15" : "bg-muted/50"}`}>
        <Icon className={`w-5 h-5 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div>
        <p className={`font-display font-bold text-lg ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
