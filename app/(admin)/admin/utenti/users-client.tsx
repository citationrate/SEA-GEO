"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Search, Crown } from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  projects: number;
  analyses: number;
  updated_at: string;
  created_at: string;
}

export function UsersClient({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");

  const filtered = users.filter((u) => {
    if (planFilter !== "all" && u.plan !== planFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="font-display font-bold text-2xl text-foreground">Utenti ({users.length})</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca email o nome..." className="input-base pl-8 w-60" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["all", "demo", "base", "pro", "agency"].map((p) => (
          <button key={p} onClick={() => setPlanFilter(p)} className={`text-xs px-3 py-1.5 rounded-[2px] border transition-colors ${planFilter === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            {p === "all" ? "Tutti" : p === "demo" ? "Demo" : p === "base" ? "Base" : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Nome / Email</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Piano</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Progetti</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Analisi</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Registrato</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-foreground font-medium">{u.full_name || u.email}</p>
                  {u.full_name && <p className="text-xs text-muted-foreground">{u.email}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[2px] border ${
                    u.plan === "pro" || u.plan === "agency" ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground"
                  }`}>
                    {(u.plan === "pro" || u.plan === "agency") && <Crown className="w-3 h-3" />}
                    {u.plan === "free" || u.plan === "demo" ? "Demo" : u.plan === "base" ? "Base" : u.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground">{u.projects}</td>
                <td className="px-4 py-3 text-foreground">{u.analyses}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("it-IT")}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/utenti/${u.id}`} className="text-xs text-primary hover:text-primary/80 transition-colors font-semibold">
                    Dettaglio &rarr;
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
