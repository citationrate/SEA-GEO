"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface ReportData {
  project: { name: string; brand: string };
  run: {
    version: number;
    status: string;
    completedAt: string | null;
    modelsUsed: string[];
    totalPrompts: number;
    completedPrompts: number;
  };
  avi: {
    score: number;
    presence: number;
    rank: number;
    sentiment: number;
    consistency: number;
  } | null;
  mentionRate: number;
  competitors: { name: string; count: number }[];
  topics: { name: string; count: number }[];
}

function AVIRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke="#00d4ff" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{Math.round(score)}</span>
        <span className="text-xs text-gray-400">AVI Score</span>
      </div>
    </div>
  );
}

function ComponentBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="font-medium text-white">{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded bg-gray-800 overflow-hidden">
        <div className="h-full rounded transition-all duration-700" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/public/report/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-xl font-bold text-white">Report non trovato</p>
          <p className="text-sm text-gray-400">Il link potrebbe essere scaduto o non valido.</p>
        </div>
      </div>
    );
  }

  const { project, run, avi, mentionRate, competitors, topics } = data;

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">AI Visibility Index Report</p>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-sm text-gray-400">
            {project.brand} &middot; Analisi v{run.version} &middot; {run.completedAt ? new Date(run.completedAt).toLocaleDateString("it-IT") : ""}
          </p>
          <p className="text-xs text-gray-500">
            Modelli: {run.modelsUsed.join(", ")} &middot; {run.completedPrompts}/{run.totalPrompts} prompt
          </p>
        </div>

        {/* AVI Score */}
        {avi && (
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
            <AVIRing score={avi.score} />
            <div className="space-y-3 self-center">
              <ComponentBar label="Presenza" value={avi.presence} color="#e8956d" />
              <ComponentBar label="Posizione" value={avi.rank} color="#7eb3d4" />
              <ComponentBar label="Sentiment" value={avi.sentiment} color="#7eb89a" />
              {/* Consistency badge — separate from AVI */}
              <div className="pt-2 border-t border-gray-700">
                <span className={`inline-block px-3 py-1 rounded text-xs font-medium ${
                  avi.consistency > 80
                    ? "bg-green-900/40 text-green-400"
                    : avi.consistency >= 50
                    ? "bg-yellow-900/40 text-yellow-400"
                    : "bg-red-900/40 text-red-400"
                }`}>
                  {avi.consistency > 80 ? "Dato stabile" : avi.consistency >= 50 ? "Dato variabile" : "Dato instabile"} ({Math.round(avi.consistency)})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#111416] border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{mentionRate}%</p>
            <p className="text-xs text-gray-400 mt-1">Menzioni Brand</p>
          </div>
          <div className="bg-[#111416] border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{competitors.length}</p>
            <p className="text-xs text-gray-400 mt-1">Competitor</p>
          </div>
          <div className="bg-[#111416] border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{topics.length}</p>
            <p className="text-xs text-gray-400 mt-1">Topic</p>
          </div>
        </div>

        {/* Competitors */}
        {competitors.length > 0 && (
          <div className="bg-[#111416] border border-gray-800 rounded-lg p-5">
            <h2 className="font-semibold text-lg mb-3">Competitor ({competitors.length})</h2>
            <div className="space-y-2">
              {competitors.slice(0, 15).map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="text-gray-400">{c.count} citazioni</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Topics */}
        {topics.length > 0 && (
          <div className="bg-[#111416] border border-gray-800 rounded-lg p-5">
            <h2 className="font-semibold text-lg mb-3">Topic ({topics.length})</h2>
            <div className="flex flex-wrap gap-2">
              {topics.slice(0, 20).map((t) => (
                <span key={t.name} className="px-3 py-1 bg-gray-800 rounded text-sm">
                  {t.name} <span className="text-gray-500">({t.count})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-800">
          AI Visibility Index &middot; aicitationrate.com
        </div>
      </div>
    </div>
  );
}
