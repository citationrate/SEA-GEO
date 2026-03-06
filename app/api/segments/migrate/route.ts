import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { error } = await (supabase as any).rpc("exec_sql", {
      query: "ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS persona_attributes JSONB DEFAULT '{}';"
    }).single();

    // If rpc doesn't exist, try raw SQL via the REST endpoint
    if (error) {
      // Fallback: use supabase-js to run raw SQL
      const { error: sqlError } = await (supabase as any)
        .from("audience_segments")
        .select("persona_attributes")
        .limit(1);

      // If the column already exists, we're good
      if (!sqlError) {
        return NextResponse.json({ success: true, message: "Colonna persona_attributes gia presente" });
      }

      return NextResponse.json({ error: "Esegui manualmente: ALTER TABLE audience_segments ADD COLUMN IF NOT EXISTS persona_attributes JSONB DEFAULT '{}';" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Colonna persona_attributes aggiunta" });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
