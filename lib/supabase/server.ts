import { createServerClient as _createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export function createServerClient() {
  const cookieStore = cookies();
  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* ignored in Server Components */ }
        },
      },
    }
  );
}

export function createServiceClient() {
  const cookieStore = cookies();
  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
}
