import Link from "next/link";
import { Search, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteAdminUser } from "@/lib/site-admin";
import { ADMIN_LIST_PAGE_SIZE, adminListUrl, listPage, listSearch } from "@/lib/admin-list-query";
import { AdminUsersManager, type AdminUserRow } from "@/components/admin-users-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; busca?: string; ordem?: string }>;
}) {
  const currentAdmin = await getSiteAdminUser();
  if (!currentAdmin) redirect("/painel");

  const params = await searchParams;
  const page = listPage(params.pagina);
  const search = listSearch(params.busca);
  const sort = params.ordem === "nome" || params.ordem === "antigos" ? params.ordem : "recentes";
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("profiles")
    .select("id,full_name,email,whatsapp,state,city,created_at", { count: "exact" });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (sort === "nome") query = query.order("full_name", { ascending: true }).order("id");
  else query = query.order("created_at", { ascending: sort === "antigos" }).order("id");

  const { data: profiles, count, error } = await query.range(
    (page - 1) * ADMIN_LIST_PAGE_SIZE, page * ADMIN_LIST_PAGE_SIZE - 1,
  );
  if (error) throw new Error("Não foi possível carregar a lista de usuários.");

  // Consultar somente os convites das contas presentes nesta página.
  const ids = (profiles ?? []).map((profile) => profile.id);
  const [{ data: counts, error: countsError }, { data: admins, error: adminsError }] = await Promise.all([
    ids.length ? admin.rpc("admin_invitation_counts", { p_owner_ids: ids }) : Promise.resolve({ data: [], error: null }),
    ids.length ? admin.from("site_admins").select("user_id").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
  ]);
  if (countsError || adminsError) throw new Error("Não foi possível carregar os dados das contas.");

  const invitationsByUser = new Map<string, number>((counts ?? []).map((item: { owner_id: string; invitations_count: number | string }) => [item.owner_id, Number(item.invitations_count)] as const));
  const adminIds = new Set((admins ?? []).map((item) => item.user_id));
  const users: AdminUserRow[] = (profiles ?? []).map((profile) => ({
    ...profile,
    full_name: profile.full_name || "",
    email: profile.email || "",
    whatsapp: profile.whatsapp || "",
    state: profile.state || "",
    city: profile.city || "",
    invitations: invitationsByUser.get(profile.id) ?? 0,
    is_admin: adminIds.has(profile.id),
  }));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_LIST_PAGE_SIZE));
  const pageUrl = (target: number) => adminListUrl("/admin/usuarios", { busca: search, ordem: sort, pagina: target });

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7438]">Administração</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Usuários</h1>
        <p className="mt-2 text-[#806e72]">Encontre contas, consulte os convites de cada usuário e gerencie cadastros.</p>
      </div>

      <form action="/admin/usuarios" method="GET" className="grid gap-3 rounded-[1.5rem] border border-[#e3d6cf] bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_185px_auto] sm:items-end">
        <label className="min-w-0 text-sm font-bold text-[#594147]">
          Buscar por nome ou e-mail
          <span className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-[#d8c7bd] bg-white px-3 focus-within:border-[#9e6172]">
            <Search className="size-4 shrink-0 text-[#8b767b]" />
            <input name="busca" type="search" defaultValue={search} maxLength={80} placeholder="Nome ou e-mail da conta" className="min-w-0 w-full bg-transparent text-sm font-normal outline-none" />
          </span>
        </label>
        <label className="text-sm font-bold text-[#594147]">
          Ordenar
          <select name="ordem" defaultValue={sort} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] bg-white px-3 text-sm font-normal">
            <option value="recentes">Mais recentes</option>
            <option value="antigos">Mais antigos</option>
            <option value="nome">Nome (A–Z)</option>
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button type="submit" className="h-11 rounded-full bg-[#7d1f37] px-5 text-sm font-bold text-white">Buscar</button>
          <Link href="/admin/usuarios" className="rounded-full border border-[#d8c7bd] px-4 py-3 text-xs font-bold text-[#684f55]">Limpar</Link>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[#806e72]">
        <span className="inline-flex items-center gap-2"><UsersRound className="size-4" /> {total} usuário(s) {search && "encontrado(s)"}</span>
        <span>Exibindo {users.length ? (page - 1) * ADMIN_LIST_PAGE_SIZE + 1 : 0}–{Math.min(page * ADMIN_LIST_PAGE_SIZE, total)} de {total}</span>
      </div>

      <AdminUsersManager users={users} currentAdminId={currentAdmin.id} />

      {totalPages > 1 && (
        <nav aria-label="Páginas de usuários" className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-[#684f55]">
          {page > 1 ? <Link href={pageUrl(page - 1)} className="rounded-full border border-[#d8c7bd] bg-white px-4 py-2">← Anterior</Link> : <span />}
          <span>Página {page} de {totalPages}</span>
          {page < totalPages ? <Link href={pageUrl(page + 1)} className="rounded-full border border-[#d8c7bd] bg-white px-4 py-2">Próxima →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
