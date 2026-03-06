import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { error } = await (supabase as any).rpc("exec_sql", {
      query: `
        ALTER TABLE sources ADD COLUMN IF NOT EXISTS context TEXT;
        ALTER TABLE sources ADD COLUMN IF NOT EXISTS citation_count INTEGER DEFAULT 1;
        ALTER TABLE sources ALTER COLUMN source_type SET DEFAULT 'other';
      `
    }).single();

    if (error) {
      const { error: sqlError } = await (supabase as any)
        .from("sources")
        .select("context, citation_count")
        .limit(1);

      if (!sqlError) {
        return NextResponse.json({ success: true, message: "Colonne gia presenti" });
      }

      return NextResponse.json({
        error: "Esegui manualmente:\nALTER TABLE sources ADD COLUMN IF NOT EXISTS context TEXT;\nALTER TABLE sources ADD COLUMN IF NOT EXISTS citation_count INTEGER DEFAULT 1;"
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Colonne aggiunte" });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
