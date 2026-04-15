/**
 * Server-only helpers that build the JSON `data-context` injected into the
 * AVI Kore chatbot widget. The context follows the user's currently-open
 * analysis (project, run, comparison) so the bot can reason about the same
 * data the user is looking at.
 *
 * Plan gating, ownership checks and locale resolution are responsibilities
 * of the caller (typically the page server component that mounts BotMount).
 * These builders only assemble the JSON shape.
 */

import type { EffectivePlan } from "./utils/is-pro";

export const AVI_BOT_ID = "b822ba04-30dc-4ed2-9792-c875bbf7119a";

const BOT_WIDGET_BASE_URL = "https://sdbaichatbot.com/widget.js";

/** Demo gets no bot. Base, Pro, Enterprise all share the AVI bot. */
export function aviBotIdForPlan(plan: EffectivePlan): string | null {
  if (plan === "base" || plan === "pro" || plan === "enterprise") {
    return AVI_BOT_ID;
  }
  return null;
}

export function botWidgetSrc(botId: string): string {
  return `${BOT_WIDGET_BASE_URL}?bot=${botId}`;
}

type Lang = "it" | "en" | "fr" | "de" | "es";

export interface AviContextBase {
  pagina: string;
  lingua: Lang;
  piano: EffectivePlan;
  brand: string;
}

export interface ProjectContext extends AviContextBase {
  pagina: "progetto";
  progetto_nome: string;
  paese: string | null;
  modelli_configurati: string[];
  avi_score: number | null;
  presenza: number | null;
  posizione: number | null;
  sentiment: number | null;
  ultima_analisi: string | null;
  n_analisi_totali: number;
  n_query: number;
}

export interface RunContext extends AviContextBase {
  pagina: "analisi";
  progetto_nome: string;
  versione: number;
  stato: string;
  modelli_usati: string[];
  prompt_completati: number;
  prompt_totali: number;
  avi_score: number | null;
  presenza: number | null;
  posizione: number | null;
  sentiment: number | null;
  consistency: number | null;
  competitor_top: Array<{ nome: string; avi: number | null }>;
  topic_top: string[];
  data_completamento: string | null;
}

export interface CompareContext extends AviContextBase {
  pagina: "compare";
  brand_a: string;
  brand_b: string;
  driver: string | null;
  win_rate_a: number | null;
  win_rate_b: number | null;
  fmr_a: number | null;
  fmr_b: number | null;
  comp_score_a: number | null;
  stato: string;
  modalita: string | null;
}

export type AviContext = ProjectContext | RunContext | CompareContext;

const ALLOWED_LANGS: ReadonlySet<string> = new Set([
  "it",
  "en",
  "fr",
  "de",
  "es",
]);

export function normalizeLang(input: string | null | undefined): Lang {
  if (input && ALLOWED_LANGS.has(input)) return input as Lang;
  return "it";
}

function asNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

interface ProjectLike {
  name?: unknown;
  target_brand?: unknown;
  country?: unknown;
  language?: unknown;
  models_config?: unknown;
}

interface AviRow {
  avi_score?: unknown;
  presence_score?: unknown;
  rank_score?: unknown;
  sentiment_score?: unknown;
  consistency_score?: unknown;
}

interface RunRow {
  version?: unknown;
  status?: unknown;
  models_used?: unknown;
  completed_prompts?: unknown;
  total_prompts?: unknown;
  completed_at?: unknown;
}

export function buildProjectContext(args: {
  plan: EffectivePlan;
  lang: Lang;
  project: ProjectLike;
  lastAvi: AviRow | null;
  lastRun: RunRow | null;
  totalRuns: number;
  totalQueries: number;
}): ProjectContext {
  const { plan, lang, project, lastAvi, lastRun, totalRuns, totalQueries } =
    args;
  const modelsCfg = Array.isArray(project.models_config)
    ? project.models_config.filter((m): m is string => typeof m === "string")
    : [];

  return {
    pagina: "progetto",
    lingua: lang,
    piano: plan,
    brand: asString(project.target_brand),
    progetto_nome: asString(project.name),
    paese: typeof project.country === "string" ? project.country : null,
    modelli_configurati: modelsCfg,
    avi_score: asNumberOrNull(lastAvi?.avi_score),
    presenza: asNumberOrNull(lastAvi?.presence_score),
    posizione: asNumberOrNull(lastAvi?.rank_score),
    sentiment: asNumberOrNull(lastAvi?.sentiment_score),
    ultima_analisi:
      typeof lastRun?.completed_at === "string" ? lastRun.completed_at : null,
    n_analisi_totali: totalRuns,
    n_query: totalQueries,
  };
}

export function buildRunContext(args: {
  plan: EffectivePlan;
  lang: Lang;
  brand: string;
  projectName: string;
  run: RunRow;
  avi: AviRow | null;
  competitorTop: Array<{ name: string; avi: number | null }>;
  topicTop: string[];
}): RunContext {
  const { plan, lang, brand, projectName, run, avi, competitorTop, topicTop } =
    args;
  const models = Array.isArray(run.models_used)
    ? run.models_used.filter((m): m is string => typeof m === "string")
    : [];

  return {
    pagina: "analisi",
    lingua: lang,
    piano: plan,
    brand,
    progetto_nome: projectName,
    versione: typeof run.version === "number" ? run.version : 0,
    stato: asString(run.status, "unknown"),
    modelli_usati: models,
    prompt_completati:
      typeof run.completed_prompts === "number" ? run.completed_prompts : 0,
    prompt_totali:
      typeof run.total_prompts === "number" ? run.total_prompts : 0,
    avi_score: asNumberOrNull(avi?.avi_score),
    presenza: asNumberOrNull(avi?.presence_score),
    posizione: asNumberOrNull(avi?.rank_score),
    sentiment: asNumberOrNull(avi?.sentiment_score),
    consistency: asNumberOrNull(avi?.consistency_score),
    competitor_top: competitorTop.slice(0, 10).map((c) => ({
      nome: c.name,
      avi: c.avi,
    })),
    topic_top: topicTop.slice(0, 15),
    data_completamento:
      typeof run.completed_at === "string" ? run.completed_at : null,
  };
}

interface CompareRow {
  brand_a?: unknown;
  brand_b?: unknown;
  driver?: unknown;
  win_rate_a?: unknown;
  win_rate_b?: unknown;
  fmr_a?: unknown;
  fmr_b?: unknown;
  comp_score_a?: unknown;
  status?: unknown;
  mode?: unknown;
}

export function buildCompareContext(args: {
  plan: EffectivePlan;
  lang: Lang;
  analysis: CompareRow;
}): CompareContext {
  const { plan, lang, analysis } = args;
  const brandA = asString(analysis.brand_a);

  return {
    pagina: "compare",
    lingua: lang,
    piano: plan,
    brand: brandA,
    brand_a: brandA,
    brand_b: asString(analysis.brand_b),
    driver: typeof analysis.driver === "string" ? analysis.driver : null,
    win_rate_a: asNumberOrNull(analysis.win_rate_a),
    win_rate_b: asNumberOrNull(analysis.win_rate_b),
    fmr_a: asNumberOrNull(analysis.fmr_a),
    fmr_b: asNumberOrNull(analysis.fmr_b),
    comp_score_a: asNumberOrNull(analysis.comp_score_a),
    stato: asString(analysis.status, "unknown"),
    modalita: typeof analysis.mode === "string" ? analysis.mode : null,
  };
}
