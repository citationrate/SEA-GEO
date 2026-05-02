import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ALL_MODEL_IDS, PRO_ONLY_MODEL_IDS, DEMO_MODEL_IDS } from "@citationrate/llm-client";
import { getUserPlanLimits } from "@/lib/usage";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  if ((project as any).user_id !== user.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  return NextResponse.json(project);
}

const updateSchema = z.object({
  name: z.string().min(1, "Nome progetto obbligatorio"),
  target_brand: z.string().min(1, "Brand target obbligatorio"),
  website_url: z.string().min(1, "Sito web obbligatorio"),
  sector: z.string().nullable().default(null),
  brand_type: z.string().nullable().default(null),
  market_context: z.string().nullable().default(null),
  language: z.enum(["it", "en", "fr", "de", "es"]),
  country: z.string().nullable().default(null),
  models_config: z.array(z.string()).min(1).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, models_config")
    .eq("id", params.id)
    .single();

  if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  if ((project as any).user_id !== user.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const body = await request.json();

  // Handle restore action
  if (body.restore === true) {
    const { error: dbError } = await (supabase.from("projects") as any)
      .update({ deleted_at: null })
      .eq("id", params.id);
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join(", ");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // If models_config is being updated, enforce plan limits + valid IDs.
  // Models can be added or removed at any time. Historical run data remains
  // queryable per-model in avi_history/prompts_executed; the trend chart
  // uses each run's self-contained AVI score (already normalised 0-100), so
  // editing the active model set doesn't break comparability.
  if (parsed.data.models_config) {
    const currentModels = ((project as any).models_config as string[]) ?? [];
    const newModels = Array.from(new Set(parsed.data.models_config));

    const validIds = new Set(ALL_MODEL_IDS as readonly string[]);
    const invalid = newModels.filter((m) => !validIds.has(m));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Modelli sconosciuti: ${invalid.join(", ")}` }, { status: 400 });
    }

    // Read user plan id (the limits view returns the resolved plan id).
    const cr = createCitationRateServiceClient();
    const { data: profile } = await cr.from("profiles").select("plan").eq("id", user.id).single();
    const planId = ((profile as any)?.plan ?? "demo") as string;
    const isDemoPlan = !planId || planId === "demo" || planId === "free";
    const isProPlan = planId === "pro" || planId === "enterprise";

    if (isDemoPlan) {
      return NextResponse.json({ error: "Il piano Demo non consente modifiche dei modelli." }, { status: 403 });
    }

    if (!isProPlan) {
      const proUsed = newModels.filter((id) => PRO_ONLY_MODEL_IDS.has(id));
      // Allow Demo's pre-seeded pro models (gemini-3.1-pro) to remain on Base
      // if they were already in the project — they're whitelisted at create time.
      const proAdded = proUsed.filter((id) => !currentModels.includes(id));
      if (proAdded.length > 0) {
        return NextResponse.json({ error: `${proAdded.join(", ")} disponibile solo dal piano Pro.` }, { status: 403 });
      }
    }

    const plan = await getUserPlanLimits(user.id);
    const cap = (plan as any)?.max_models_per_project ?? (isProPlan ? 5 : 3);
    if (newModels.length > cap) {
      return NextResponse.json({ error: `Il tuo piano supporta max ${cap} modelli per progetto.` }, { status: 403 });
    }

    parsed.data.models_config = newModels;
  }

  const { error: dbError } = await (supabase.from("projects") as any)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  // Verify project belongs to user and is not already deleted
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();

  if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  if ((project as any).user_id !== user.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  // Soft delete: set deleted_at instead of deleting
  const { error: dbError } = await (supabase.from("projects") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
