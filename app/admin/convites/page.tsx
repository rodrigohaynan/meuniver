import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Eye, ExternalLink, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { AdminDeleteInvitationButton } from "@/components/admin-delete-invitation-button";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteAdminUser } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const adminUser = await getSiteAdminUser();
  if (!adminUser) redirect("/painel");

  const query = await searchParams;
  const parsed = Number(query.pagina ?? 1);
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100000) : 1;
  const admin = createAdminSupabaseClient();
  const { data, count, error } = await admin
    .from("invitations")
    .select("id,owner_id,slug,status,event_title,host_name,event_date,created_at,hero_image_url", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (error) throw new Error("Não foi possível carregar os convites.");
  const invitations = data ?? [];
  const ownerIds = [...new Set(invitations.map((item) => item.owner_id))];
  const { data: profiles, error: profilesError } = ownerIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", ownerIds)
    : { data: [], error: null };

  if (profilesError) throw new Error("Não foi possível carregar os proprietários dos convites.");

  const owners = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7438]">Administração</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Todos os convites</h1>
          <p className="mt-2 text-sm leading-6 text-[#806e72]">
            Visualize convites de todas as contas, inclusive rascunhos. Esta área não permite editar convites; apenas visualizá-los ou excluí-los.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#f1e2dd] px-4 py-2 text-sm font-bold text-[#7d1f37]">
          <ShieldCheck className="size-4" /> {total} convite(s)
        </span>
      </div>

      {!invitations.length ? (
        <div className="mt-7 rounded-[1.5rem] border border-[#e3d6cf] bg-white p-8 text-center text-[#806e72]">
          {page > 1 ? "Nenhum convite nesta página." : "Nenhum convite cadastrado."}
          {page > 1 && <div className="mt-3"><Link className="font-bold text-[#7d1f37]" href="/admin/convites">Voltar ao início</Link></div>}
        </div>
      ) : (
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {invitations.map((item) => {
            const owner = owners.get(item.owner_id);
            return (
              <article key={item.id} className="overflow-hidden rounded-[1.5rem] border border-[#e3d6cf] bg-white shadow-sm">
                <div
                  className="h-32 bg-[#f4e7e0]"
                  style={item.hero_image_url
                    ? { backgroundImage: `url("${item.hero_image_url}")`, backgroundSize: "cover", backgroundPosition: "center" }
                    : undefined}
                >
                  {!item.hero_image_url && <div className="grid h-full place-items-center"><CalendarDays className="size-9 text-[#ba795a]" /></div>}
                </div>
                <div className="p-5">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === "published" ? "bg-emerald-50 text-emerald-800" : "bg-[#f4ece6] text-[#775c51]"}`}>
                    {item.status === "published" ? "Publicado" : "Rascunho"}
                  </span>
                  <h2 className="mt-4 font-display text-xl font-bold text-[#351820]">{item.event_title || item.host_name || "Convite sem título"}</h2>
                  <p className="mt-2 break-words text-sm text-[#806e72]">
                    Proprietário: {owner?.full_name || owner?.email || "Conta não identificada"}
                    {owner?.full_name && owner?.email ? ` · ${owner.email}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[#8b767b]">
                    {item.event_date ? `Evento: ${new Date(`${item.event_date}T12:00:00`).toLocaleDateString("pt-BR")}` : "Evento sem data definida"}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Link href={`/admin/convites/${item.id}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#7d1f37] px-4 text-sm font-bold text-white">
                      <Eye className="size-4" /> Visualizar
                    </Link>
                    {item.status === "published" && (
                      <Link href={`/c/${item.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1 rounded-full border border-[#e3d6cf] px-3 text-xs font-bold text-[#684f55]">
                        Abrir convite <ExternalLink className="size-3.5" />
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
        <nav aria-label="Páginas dos convites" className="mt-7 flex items-center justify-between gap-3 text-sm font-bold text-[#684f55]">
          {page > 1
            ? <Link href={page === 2 ? "/admin/convites" : `/admin/convites?pagina=${page - 1}`} className="inline-flex items-center gap-2 rounded-full border border-[#dccdc5] bg-white px-4 py-2"><ArrowLeft className="size-4" /> Anterior</Link>
            : <span />}
          <span>Página {page} de {totalPages}</span>
          {page < totalPages
            ? <Link href={`/admin/convites?pagina=${page + 1}`} className="inline-flex items-center gap-2 rounded-full border border-[#dccdc5] bg-white px-4 py-2">Próxima <ArrowRight className="size-4" /></Link>
            : <span />}
        </nav>
      )}
    </div>
  );
}
