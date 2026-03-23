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
  website_url: z.string().nullable().default(null),
  known_competitors: z.array(z.string()).default([]),
  market_context: z.string().nullable().default(null),
  language: z.enum(["it", "en"]),
  country: z.string().nullable().default(null),
  models_config: z.array(z.string()).min(1).default(["gpt-4o-mini"]),
});

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = projectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    }

    const { data, error: dbError } = await supabase
      .from("projects")
      .insert({ ...parsed.data, user_id: user.id } as any)
      .select("id")
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
