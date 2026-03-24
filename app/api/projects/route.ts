import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const { data } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  return NextResponse.json(data ?? []);
}

const projectSchema = z.object({
  name: z.string().min(1),
  target_brand: z.string().min(1),
  sector: z.string().nullable().default(null),
  brand_type: z.string().nullable().default(null),
  website_url: z.string().nullable().default(null),
  known_competitors: z.array(z.string()).default([]),
  market_context: z.string().nullable().default(null),
  language: z.enum(["it", "en"]),
  country: z.string().nullable().default(null),
  models_config: z.array(z.string()).min(1).default(["gpt-5.4-mini"]),
  site_analysis: z.any().nullable().default(null),
});

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    console.log("[API/PROJECTS] POST called, user:", user.id);
    console.log("[API/PROJECTS] Body:", JSON.stringify(body));

    const parsed = projectSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[API/PROJECTS] Validation failed:", parsed.error.flatten());
      return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error: dbError } = await supabase
      .from("projects")
      .insert({ ...parsed.data, user_id: user.id } as any)
      .select("id")
      .single();

    if (dbError) {
      console.error("[API/PROJECTS] DB error:", dbError.message, dbError.code, dbError.details);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[API/PROJECTS] Unhandled error:", err instanceof Error ? err.message : err);
    console.error("[API/PROJECTS] Stack:", err instanceof Error ? err.stack : "N/A");
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore interno" }, { status: 500 });
  }
}
