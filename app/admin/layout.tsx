import Image from "next/image";
import Link from "next/link";
import { BarChart3, CircleDollarSign, FileText, LayoutDashboard, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { getSiteAdminUser } from "@/lib/site-admin";
import { LogoutButton } from "@/components/logout-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSiteAdminUser();
  if (!user) redirect("/painel");

  return (
    <main className="min-h-screen bg-[#f6f2ef] text-[#351820]">
      <header className="sticky top-0 z-50 border-b border-[#e6d9d2] bg-[#f6f2ef]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center">
              <Image src="/brand/convniver-logo.png" alt="CONVNIVER" width={260} height={89} className="h-auto w-[145px]" priority />
            </Link>
            <span className="hidden rounded-full bg-[#7d1f37] px-3 py-1 text-xs font-bold uppercase tracking-[.14em] text-white sm:inline">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/painel" className="rounded-full border border-[#dccdc5] bg-white px-4 py-2 text-sm font-bold text-[#684f55]">Painel do usuário</Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-[1.5rem] border border-[#e3d6cf] bg-white p-3 shadow-sm">
          <nav className="space-y-1 text-sm font-bold">
            <AdminLink href="/admin" icon={<LayoutDashboard className="size-4" />}>Visão geral</AdminLink>
            <AdminLink href="/admin/usuarios" icon={<UsersRound className="size-4" />}>Usuários</AdminLink>
            <AdminLink href="/admin/financeiro" icon={<CircleDollarSign className="size-4" />}>Financeiro</AdminLink>
            <AdminLink href="/admin/relatorios" icon={<FileText className="size-4" />}>Relatórios</AdminLink>
          </nav>
          <div className="mt-4 border-t border-[#eee4de] pt-4 text-xs leading-5 text-[#8b767b]">
            <div className="flex items-center gap-2 font-bold text-[#684f55]"><BarChart3 className="size-4" /> Administração global</div>
            <p className="mt-1">Área restrita ao proprietário do CONVNIVER.</p>
          </div>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}

function AdminLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link href={href} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[#684f55] transition hover:bg-[#f8efeb] hover:text-[#7d1f37]">{icon}{children}</Link>;
}
