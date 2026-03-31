import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
  user_id: z.string().uuid(),
});

function getCitationRateClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.CITATIONRATE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing CitationRate env vars");
  return createClient(url, key);
}

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const { data: callerProfile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    const isAdmin = (callerProfile as any)?.is_admin === true || user.email?.endsWith("@seageo.it");
    if (!isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

    const userId = parsed.data.user_id;
    const svc = createServiceClient();
    const log: { step: string; ok: boolean; error?: string }[] = [];

    // Get user's project IDs
    let projectIds: string[] = [];
    try {
      const { data: projects } = await svc.from("projects").select("id").eq("user_id", userId);
      projectIds = (projects ?? []).map((p: any) => p.id);
      log.push({ step: "fetch_projects", ok: true });
    } catch (err: any) {
      log.push({ step: "fetch_projects", ok: false, error: err.message });
    }

    if (projectIds.length > 0) {
      // Get run IDs
      let runIds: string[] = [];
      try {
        const { data: runs } = await svc.from("analysis_runs").select("id").in("project_id", projectIds);
        runIds = (runs ?? []).map((r: any) => r.id);
        log.push({ step: "fetch_runs", ok: true });
      } catch (err: any) {
        log.push({ step: "fetch_runs", ok: false, error: err.message });
      }

      if (runIds.length > 0) {
        // Get prompt IDs
        let promptIds: string[] = [];
        try {
          const { data: prompts } = await svc.from("prompts_executed").select("id").in("run_id", runIds);
          promptIds = (prompts ?? []).map((p: any) => p.id);
          log.push({ step: "fetch_prompts", ok: true });
        } catch (err: any) {
          log.push({ step: "fetch_prompts", ok: false, error: err.message });
        }

        if (promptIds.length > 0) {
          // Delete competitor_mentions
          try {
            await (svc.from("competitor_mentions") as any).delete().in("prompt_executed_id", promptIds);
            log.push({ step: "delete_competitor_mentions", ok: true });
          } catch (err: any) {
            log.push({ step: "delete_competitor_mentions", ok: false, error: err.message });
          }

          // Delete sources
          try {
            await (svc.from("sources") as any).delete().in("prompt_executed_id", promptIds);
            log.push({ step: "delete_sources", ok: true });
          } catch (err: any) {
            log.push({ step: "delete_sources", ok: false, error: err.message });
          }

          // Delete response_analysis
          try {
            await svc.from("response_analysis").delete().in("prompt_executed_id", promptIds);
            log.push({ step: "delete_response_analysis", ok: true });
          } catch (err: any) {
            log.push({ step: "delete_response_analysis", ok: false, error: err.message });
          }

          // Delete prompts_executed
          try {
            await svc.from("prompts_executed").delete().in("run_id", runIds);
            log.push({ step: "delete_prompts_executed", ok: true });
          } catch (err: any) {
            log.push({ step: "delete_prompts_executed", ok: false, error: err.message });
          }
        }

        // Delete competitor_avi
        try {
          await (svc.from("competitor_avi") as any).delete().in("run_id", runIds);
          log.push({ step: "delete_competitor_avi", ok: true });
        } catch (err: any) {
          log.push({ step: "delete_competitor_avi", ok: false, error: err.message });
        }

        // Delete avi_history
        try {
          await svc.from("avi_history").delete().in("run_id", runIds);
          log.push({ step: "delete_avi_history", ok: true });
        } catch (err: any) {
          log.push({ step: "delete_avi_history", ok: false, error: err.message });
        }

        // Delete analysis_runs
        try {
          await svc.from("analysis_runs").delete().in("project_id", projectIds);
          log.push({ step: "delete_analysis_runs", ok: true });
        } catch (err: any) {
          log.push({ step: "delete_analysis_runs", ok: false, error: err.message });
        }
      }

      // Delete competitors
      try {
        await (svc.from("competitors") as any).delete().in("project_id", projectIds);
        log.push({ step: "delete_competitors", ok: true });
      } catch (err: any) {
        log.push({ step: "delete_competitors", ok: false, error: err.message });
      }

      // Delete topics
      try {
        await (svc.from("topics") as any).delete().in("project_id", projectIds);
        log.push({ step: "delete_topics", ok: true });
      } catch (err: any) {
        log.push({ step: "delete_topics", ok: false, error: err.message });
      }

      // Delete audience_segments
      try {
        await svc.from("audience_segments").delete().in("project_id", projectIds);
        log.push({ step: "delete_audience_segments", ok: true });
      } catch (err: any) {
        log.push({ step: "delete_audience_segments", ok: false, error: err.message });
      }

      // Delete queries
      try {
        await svc.from("queries").delete().in("project_id", projectIds);
        log.push({ step: "delete_queries", ok: true });
      } catch (err: any) {
        log.push({ step: "delete_queries", ok: false, error: err.message });
      }

      // Delete projects
      try {
        await svc.from("projects").delete().eq("user_id", userId);
        log.push({ step: "delete_projects", ok: true });
      } catch (err: any) {
        log.push({ step: "delete_projects", ok: false, error: err.message });
      }
    }

    // Delete package_purchases
    try {
      await (svc.from("package_purchases") as any).delete().eq("user_id", userId);
      log.push({ step: "delete_package_purchases", ok: true });
    } catch (err: any) {
      log.push({ step: "delete_package_purchases", ok: false, error: err.message });
    }

    // Reset usage_monthly
    try {
      await (svc.from("usage_monthly") as any).delete().eq("user_id", userId);
      log.push({ step: "delete_usage_monthly", ok: true });
    } catch (err: any) {
      log.push({ step: "delete_usage_monthly", ok: false, error: err.message });
    }

    // Reset profile on CitationRate
    try {
      const cr = getCitationRateClient();
      await cr.from("profiles").update({
        plan: "demo",
        subscription_status: "inactive",
        subscription_period: null,
        stripe_subscription_id: null,
        stripe_customer_id: null,
      } as any).eq("id", userId);
      log.push({ step: "reset_citationrate_profile", ok: true });
    } catch (err: any) {
      log.push({ step: "reset_citationrate_profile", ok: false, error: err.message });
    }

    // Also reset plan on seageo1 profiles
    try {
      await (svc.from("profiles") as any).update({
        plan: "demo",
      }).eq("id", userId);
      log.push({ step: "reset_seageo1_profile", ok: true });
    } catch (err: any) {
      log.push({ step: "reset_seageo1_profile", ok: false, error: err.message });
    }

    const failures = log.filter((s) => !s.ok);
    console.log(`[reset-demo] Completed for ${userId}:`, JSON.stringify(log));

    return NextResponse.json({ success: true, steps: log.length, failures: failures.length });
  } catch (err: any) {
    console.error("[reset-demo] Fatal error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
