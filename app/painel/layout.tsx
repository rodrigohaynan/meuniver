import Link from "next/link";
import { redirect } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Meu Convite";

  return (
    <main className="min-h-screen bg-[#f8f4f1]">
      <header className="sticky top-0 z-40 border-b border-[#e6d9d2] bg-[#f8f4f1]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/painel" className="flex items-center gap-2 font-display text-xl font-bold text-[#4b2230]">
            <span className="grid size-9 place-items-center rounded-xl bg-[#7d1f37] text-white"><PartyPopper className="size-4" /></span>
            {appName}
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-56 truncate text-sm text-[#806e72] sm:block">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}
