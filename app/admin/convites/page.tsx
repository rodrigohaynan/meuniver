import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Eye, ExternalLink, Search, ShieldCheck, UsersRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AdminDeleteInvitationButton } from "@/components/admin-delete-invitation-button";
import { ADMIN_LIST_PAGE_SIZE, adminListUrl, isUuid, listPage, listSearch } from "@/lib/admin-list-query";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteAdminUser } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; usuario?: string; busca?: string; status?: string; ordem?: string }>;
}) {
  const adminUser = await getSiteAdminUser();
  if (!adminUser) redirect("/painel");

  const params = await searchParams;
  const page = listPage(params.pagina);
  const search = listSearch(params.busca);
  const ownerId = String(params.usuario ?? "").trim();
  if (ownerId && !isUuid(ownerId)) notFound();

  const status = params.status === "published" || params.status === "draft" ? params.status : "todos";
  const sort = params.ordem === "antigos" || params.ordem === "evento" ? params.ordem : "recentes";
  const admin = createAdminSupabaseClient();

  let query = admin
    .from("invitations")
    .select("id,owner_id,slug,status,event_title,host_name,event_date,created_at,hero_image_url", { count: "exact" });
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (status !== "todos") query = query.eq("status", status);
  if (search) query = query.or(`event_title.ilike.%${search}%,host_name.ilike.%${search}%`);
  if (sort === "evento") query = query.order("event_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  else query = query.order("created_at", { ascending: sort === "antigos" }).order("id");

  const [{ data, count, error }, { data: selectedOwner, error: selectedOwnerError }] = await Promise.all([
    query.range((page - 1) * ADMIN_LIST_PAGE_SIZE, page * ADMIN_LIST_PAGE_SIZE - 1),
    ownerId
      ? admin.from("profiles").select("id,full_name,email").eq("id", ownerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (error || selectedOwnerError) throw new Error("Não foi possível consultar os convites.");
  if (ownerId && !selectedOwner) notFound();

  const invitations = data ?? [];
  const ownerIds = [...new Set(invitations.map((item) => item.owner_id))];
  const { data: profiles, error: profilesError } = ownerIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", ownerIds)
    : { data: [], error: null };
  if (profilesError) throw new Error("Não foi possível carregar os proprietários dos convites.");

  const owners = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_LIST_PAGE_SIZE));
  const pageUrl = (target: number) => adminListUrl("/admin/convites", {
    usuario: ownerId, busca: search, status, ordem: sort, pagina: target,
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7438]">Administração</p>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
            {ownerId ? "Convites do usuário" : "Todos os convites"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#806e72]">
            Consulte os convites sem editar dados de outras contas. A exclusão exige confirmação.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#f1e2dd] px-4 py-2 text-sm font-bold text-[#7d1f37]">
          <ShieldCheck className="size-4" /> {total} convite(s)
        </span>
      </div>

      {ownerId && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e3d6cf] bg-white p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-[#351820]"><UsersRound className="size-4 text-[#7d1f37]" /> {selectedOwner?.full_name || selectedOwner?.email || "Usuário"}</p>
            <p className="mt-1 break-all text-xs text-[#806e72]">{selectedOwner?.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/usuarios" className="rounded-full border border-[#dccdc5] px-4 py-2 text-xs font-bold text-[#684f55]">Usuários</Link>
            <Link href="/admin/convites" className="rounded-full bg-[#7d1f37] px-4 py-2 text-xs font-bold text-white">Ver todos</Link>
          </div>
        </div>
      )}

      <form method="GET" action="/admin/convites" className="mt-5 grid gap-3 rounded-[1.5rem] border border-[#e3d6cf] bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_155px_155px_auto] lg:items-end">
        {ownerId && <input type="hidden" name="usuario" value={ownerId} />}
        <label className="min-w-0 text-sm font-bold text-[#594147]">
          Buscar convite
          <span className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-[#d8c7bd] px-3 focus-within:border-[#9e6172]">
            <Search className="size-4 shrink-0 text-[#8b767b]" />
            <input name="busca" type="search" defaultValue={search} maxLength={80} placeholder="Título ou homenageado" className="min-w-0 w-full bg-transparent text-sm font-normal outline-none" />
          </span>
        </label>
        <label className="text-sm font-bold text-[#594147]">
          Situação
          <select name="status" defaultValue={status} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] bg-white px-3 text-sm font-normal">
            <option value="todos">Todos</option>
            <option value="published">Publicados</option>
            <option value="draft">Rascunhos</option>
          </select>
        </label>
        <label className="text-sm font-bold text-[#594147]">
          Ordenação
          <select name="ordem" defaultValue={sort} className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] bg-white px-3 text-sm font-normal">
            <option value="recentes">Mais recentes</option>
            <option value="antigos">Mais antigos</option>
            <option value="evento">Data do evento</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="h-11 rounded-full bg-[#7d1f37] px-5 text-sm font-bold text-white">Buscar</button>
          <Link href={adminListUrl("/admin/convites", { usuario: ownerId })} className="rounded-full border border-[#d8c7bd] px-4 py-3 text-xs font-bold text-[#684f55]">Limpar</Link>
        </div>
      </form>

      <p className="mt-4 text-sm text-[#806e72]">
        Exibindo {invitations.length ? (page - 1) * ADMIN_LIST_PAGE_SIZE + 1 : 0}–{Math.min(page * ADMIN_LIST_PAGE_SIZE, total)} de {total} convite(s)
      </p>

      {!invitations.length ? (
        <div className="mt-5 rounded-[1.5rem] border border-dashed border-[#e3d6cf] bg-white p-8 text-center text-sm text-[#806e72]">
          Nenhum convite encontrado. Altere a busca ou os filtros.
          {page > 1 && <div className="mt-3"><Link className="font-bold text-[#7d1f37]" href={pageUrl(1)}>Voltar à primeira página</Link></div>}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {invitations.map((item) => {
            const owner = owners.get(item.owner_id);
            return (
              <article key={item.id} className="overflow-hidden rounded-[1.5rem] border border-[#e3d6cf] bg-white shadow-sm">
                <div
                  className="h-28 bg-[#f4e7e0]"
                  style={item.hero_image_url
                    ? { backgroundImage: `url("${item.hero_image_url}")`, backgroundSize: "cover", backgroundPosition: "center" }
                    : undefined}
                >
                  {!item.hero_image_url && <div className="grid h-full place-items-center"><CalendarDays className="size-9 text-[#ba795a]" /></div>}
                </div>
                <div className="p-4 sm:p-5">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === "published" ? "bg-emerald-50 text-emerald-800" : "bg-[#f4ece6] text-[#775c51]"}`}>
                    {item.status === "published" ? "Publicado" : "Rascunho"}
                  </span>
                  <h2 className="mt-3 line-clamp-2 font-display text-xl font-bold text-[#351820]">{item.event_title || item.host_name || "Convite sem título"}</h2>
                  <p className="mt-2 break-words text-sm text-[#806e72]">
                    Proprietário: {owner?.full_name || owner?.email || "Conta não identificada"}
                    {owner?.full_name && owner?.email ? ` · ${owner.email}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[#8b767b]">
                    {item.event_date ? `Evento: ${new Date(`${item.event_date}T12:00:00`).toLocaleDateString("pt-BR")}` : "Evento sem data definida"}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link href={adminListUrl(`/admin/convites/${item.id}`, { usuario: ownerId })} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#7d1f37] px-4 text-sm font-bold text-white">
                      <Eye className="size-4" /> Visualizar
                    </Link>
                    {item.status === "published" && (
                      <Link href={`/c/${item.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1 rounded-full border border-[#e3d6cf] px-3 text-xs font-bold text-[#684f55]">
                        Abrir <ExternalLink className="size-3.5" />
                      </Link>
                    )}
                    <AdminDeleteInvitationButton id={item.id} title={item.event_title || item.host_name || "Convite"} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Páginas de convites" className="mt-7 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-[#684f55]">
          {page > 1
            ? <Link href={pageUrl(page - 1)} className="inline-flex items-center gap-2 rounded-full border border-[#dccdc5] bg-white px-4 py-2"><ArrowLeft className="size-4" /> Anterior</Link>
            : <span />}
          <span>Página {page} de {totalPages}</span>
          {page < totalPages
            ? <Link href={pageUrl(page + 1)} className="inline-flex items-center gap-2 rounded-full border border-[#dccdc5] bg-white px-4 py-2">Próxima <ArrowRight className="size-4" /></Link>
            : <span />}
        </nav>
      )}
    </div>
  );
}
