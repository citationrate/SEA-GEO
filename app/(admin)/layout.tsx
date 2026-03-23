import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { AdminSidebar } from "./admin-sidebar";

export const metadata = { title: { default: "Admin — AVI", template: "%s | Admin AVI" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const isAdmin = (profile as any)?.is_admin === true || user.email?.endsWith("@seageo.it");

  if (!isAdmin) redirect("/dashboard");

  return (
    <div className="flex h-screen bg-ink overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="h-12 flex-shrink-0 border-b border-border px-6 flex items-center justify-between" style={{ background: "var(--surface)" }}>
          <span className="font-mono text-xs text-destructive tracking-widest uppercase">Admin Panel</span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
