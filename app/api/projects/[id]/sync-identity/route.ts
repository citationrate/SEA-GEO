import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";

// Sync-identity (punto 1/B): quando la suite RIUSA un progetto AVI già linkato,
// il progetto può portarsi dietro brand/sito/settore di una versione precedente
// (e quindi un site_analysis stantìo) che inquina la generazione domande.
// Questo endpoint allinea l'identità corrente sul progetto AVI e, se il sito è
// cambiato, INVALIDA site_analysis (lo azzera) così il prossimo seed lo
// ri-crawla fresco. È un update PARZIALE e mirato: NON tocca campi non passati
// (a differenza del PATCH /projects/[id] che fa full-replace con default null).
const schema = z.object({
  target_brand: z.string().trim().min(1).max(200).optional(),
  website_url: z.string().trim().min(1).max(500).optional(),
  sector: z.string().trim().min(1).max(200).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    const { target_brand, website_url, sector } = parsed.data;

    const { data: project } = await supabase
      .from("projects")
      .select("id, user_id, target_brand, website_url, sector, site_analysis")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
    if ((project as any).user_id !== user.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

    const p = project as any;
    const norm = (s?: string | null) => (typeof s === "string" ? s.trim() : "");

    const patch: Record<string, unknown> = {};
    if (target_brand && norm(target_brand) !== norm(p.target_brand)) patch.target_brand = target_brand;
    if (sector && norm(sector) !== norm(p.sector)) patch.sector = sector;

    // Sito cambiato → aggiorna URL e AZZERA site_analysis (residuo della vecchia
    // identità). Il prossimo seed, trovando site_analysis nullo, ri-crawla e
    // ripersiste il profilo corretto col fingerprint __source_url aggiornato.
    let refreshed = false;
    if (website_url && norm(website_url) !== norm(p.website_url)) {
      patch.website_url = website_url;
      patch.site_analysis = null;
      refreshed = true;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: true, changed: false, refreshed: false });
    }

    const { error: dbError } = await (supabase.from("projects") as any)
      .update(patch)
      .eq("id", params.id)
      .eq("user_id", user.id);
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ ok: true, changed: true, refreshed });
  } catch (err: any) {
    console.error("[sync-identity] error:", err?.message ?? err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
