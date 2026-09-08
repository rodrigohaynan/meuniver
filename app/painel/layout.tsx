import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

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
