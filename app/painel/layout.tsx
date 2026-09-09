import Image from "next/image";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const displayName = String(user.user_metadata?.full_name ?? "").trim();

  return (
    <main className="min-h-screen bg-[#f8f4f1]">
      <header className="sticky top-0 z-40 border-b border-[#e6d9d2] bg-[#f8f4f1]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/painel" className="flex items-center">
            <Image
              src="/brand/convniver-logo.png"
              alt="CONVNIVER"
              width={260}
              height={89}
              className="h-auto w-[145px] sm:w-[170px]"
              priority
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden max-w-44 truncate text-sm text-[#806e72] lg:block">
              {displayName || user.email}
            </span>
            <Link
              href="/painel/minha-conta"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dccdc5] bg-white px-3 text-sm font-bold text-[#684f55] transition hover:bg-[#fff9f5] sm:px-4"
            >
              <UserRound className="size-4" />
              <span className="hidden sm:inline">Minha conta</span>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}
