import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const auth = createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  redirect(user ? "/dashboard" : "/login");
}
