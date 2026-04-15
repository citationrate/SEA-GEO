"use client";

import {
  BarChart, Bar, Cell, LabelList, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useTranslation } from "@/lib/i18n/context";

const TOOLTIP_STYLE = {
  background: "var(--ink-3)",
  border: "1px solid var(--line)",
  borderRadius: 2,
  fontSize: 12,
  color: "var(--white)",
};

interface CompetitorData {
  name: string;
  avi: number;
}

export default function CompetitorBar({ data }: { data?: CompetitorData[] }) {
  const { t } = useTranslation();
  const compData = (data ?? []).sort((a, b) => b.avi - a.avi);

  if (compData.length === 0) {
    return (
      <div data-tour="top-competitors" className="card p-5">
        <h3 className="font-display text-sm text-foreground mb-4" style={{ fontWeight: 300 }}>{t("dashboard.topCompetitors")}</h3>
        <div className="flex items-center justify-center py-8">
          <p className="font-mono text-[13px] text-cream-dim">{t("dashboard.noCompetitorFound")}</p>
        </div>
      </div>
    );
  }

  return (
    <div data-tour="top-competitors" className="card p-5">
      <h3 className="font-display text-sm text-foreground mb-4" style={{ fontWeight: 300 }}>{t("dashboard.topCompetitors")}</h3>
      <ResponsiveContainer width="100%" height={Math.max(80, compData.length * 35)}>
        <BarChart data={compData} layout="vertical">
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--cream-dim)" }} axisLine={false} tickLine={false}/>
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--cream-dim)" }} axisLine={false} tickLine={false} width={90}/>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [`AVI ${value}`, "AVI Score"]}/>
          <Bar dataKey="avi" radius={[0,2,2,0]}>
            {compData.map((_, i) => (
              <Cell key={i} fill={i === 0 ? "#e8956d" : i === 1 ? "#c4a882" : "rgba(196,168,130,0.5)"} />
            ))}
            <LabelList dataKey="avi" position="right" style={{ fontSize: 11, fill: "var(--cream-dim)" }}/>
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
