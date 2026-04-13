import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { createClient as _createClient } from "@supabase/supabase-js";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

// CitationRate Supabase (auth project — avatar storage lives here)
function getCRServiceClient() {
  return _createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.CR_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  );
}

export async function POST(request: Request) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, and WebP images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 2 MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extMap: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const ext = extMap[file.type] || "jpg";
  const storagePath = `${user.id}/avatar.${ext}`;

  try {
    // Upload to CitationRate Supabase Storage
    const crClient = getCRServiceClient();
    await crClient.storage.from("avatars").upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });
    let publicUrl = crClient.storage.from("avatars").getPublicUrl(storagePath).data.publicUrl;
    publicUrl = `${publicUrl}?v=${Date.now()}`;

    // Update avatar_url on CitationRate profiles
    await crClient.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);

    // Update avatar_url on seageo1 profiles
    await (supabase!.from("profiles") as any).update({ avatar_url: publicUrl }).eq("id", user.id);

    return NextResponse.json({ avatar_url: publicUrl });
  } catch (e: any) {
    console.error("[avatar upload]", e?.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE() {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  const crClient = getCRServiceClient();

  // Delete all possible extensions
  for (const ext of ["jpg", "png", "webp"]) {
    try {
      await crClient.storage.from("avatars").remove([`${user.id}/avatar.${ext}`]);
    } catch {
      // ignore
    }
  }

  // Clear avatar_url on both projects
  await crClient.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  await (supabase!.from("profiles") as any).update({ avatar_url: null }).eq("id", user.id);

  return NextResponse.json({ success: true });
}
