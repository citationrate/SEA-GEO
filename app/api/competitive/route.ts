import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/lib/inngest";

const startSchema = z.object({
  project_id: z.string().uuid(),
  brand_b: z.string().min(1),
  driver: z.string().min(1),
  models: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  const supabase = createServiceClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { project_id, brand_b, driver, models } = parsed.data;

    // Get project brand
    const { data: project } = await supabase
      .from("projects")
      .select("target_brand")
      .eq("id", project_id)
      .is("deleted_at", null)
      .single();

    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    const brandA = (project as any).target_brand;

    // Create analysis
    const { data: analysis, error } = await (supabase.from("competitive_analyses") as any)
      .insert({
        project_id,
        user_id: user.id,
        brand_a: brandA,
        brand_b,
        driver,
        mode: "light",
        status: "pending",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Trigger Inngest
    await inngest.send({
      name: "competitive/start",
      data: {
        analysisId: analysis.id,
        brandA,
        brandB: brand_b,
        driver,
        models,
      },
    });

    return NextResponse.json({ id: analysis.id }, { status: 201 });
  } catch (err) {
    console.error("[competitive/start] error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
