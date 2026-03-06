import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { error } = await (supabase as any).rpc("exec_sql", {
      query: `
        ALTER TABLE competitors ADD COLUMN IF NOT EXISTS topic_context JSONB DEFAULT '[]';
        ALTER TABLE competitors ADD COLUMN IF NOT EXISTS query_type TEXT;
      `
    }).single();

    if (error) {
      // Fallback: check if columns already exist
      const { error: sqlError } = await (supabase as any)
        .from("competitors")
        .select("topic_context, query_type")
        .limit(1);

      if (!sqlError) {
        return NextResponse.json({ success: true, message: "Colonne topic_context e query_type gia presenti" });
      }

      return NextResponse.json({
        error: "Esegui manualmente:\nALTER TABLE competitors ADD COLUMN IF NOT EXISTS topic_context JSONB DEFAULT '[]';\nALTER TABLE competitors ADD COLUMN IF NOT EXISTS query_type TEXT;"
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Colonne topic_context e query_type aggiunte" });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
