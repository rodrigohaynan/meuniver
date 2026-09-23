import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, Gift, ShieldCheck } from "lucide-react";
import { AdminDeleteInvitationButton } from "@/components/admin-delete-invitation-button";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteAdminUser } from "@/lib/site-admin";
import type { GiftProfileItem } from "@/lib/types";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-xl bg-[#faf6f3] p-4">
      <dt className="text-xs font-bold uppercase tracking-[.08em] text-[#8b767b]">{label}</dt>
      <dd className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-[#3c2229]">
        {value === null || value === undefined || value === "" ? "Não informado" : String(value)}
      </dd>
    </div>
  );
}

export default async function AdminInvitationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const adminUser = await getSiteAdminUser();
  if (!adminUser) redirect("/painel");

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const admin = createAdminSupabaseClient();
  const { data: invitation, error: invitationError } = await admin
    .from("invitations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (invitationError) throw new Error("Não foi possível carregar o convite.");
  if (!invitation) notFound();

  const [{ data: profile, error: ownerError }, { data: gifts, error: giftsError }] = await Promise.all([
    admin.from("profiles").select("full_name,email").eq("id", invitation.owner_id).maybeSingle(),
    admin.from("gifts").select("id,name,description,price_hint,reserved").eq("invitation_id", invitation.id).order("sort_order"),
  ]);
  if (ownerError || giftsError) throw new Error("Não foi possível carregar os detalhes do convite.");

  const date = invitation.event_date
    ? new Date(`${invitation.event_date}T12:00:00`).toLocaleDateString("pt-BR")
    : null;
  const giftProfile = Array.isArray(invitation.gift_profile)
    ? (invitation.gift_profile as GiftProfileItem[])
    : [];

  return (
    <div className="space-y-6">
      <Link href="/admin/convites" className="inline-flex items-center gap-2 text-sm font-bold text-[#7d1f37]">
        <ArrowLeft className="size-4" /> Todos os convites
      </Link>

      <div className="overflow-hidden rounded-[1.7rem] border border-[#e3d6cf] bg-white shadow-sm">
        <div
          className="h-40 bg-[#f4e7e0] sm:h-56"
          style={invitation.hero_image_url ? {
            backgroundImage: `url("${invitation.hero_image_url}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          } : undefined}
        >
          {!invitation.hero_image_url && <div className="grid h-full place-items-center"><CalendarDays className="size-12 text-[#ba795a]" /></div>}
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-[#f4ece6] px-3 py-1.5 text-[#7d1f37]">{invitation.status === "published" ? "Publicado" : "Rascunho"}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f4ece6] px-3 py-1.5 text-[#684f55]"><ShieldCheck className="size-3.5" /> Somente leitura</span>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold text-[#351820]">{invitation.event_title || invitation.host_name || "Convite"}</h1>
          <p className="mt-2 break-words text-sm text-[#806e72]">
            Proprietário: {profile?.full_name || profile?.email || "Conta não identificada"}
            {profile?.full_name && profile?.email ? ` · ${profile.email}` : ""}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {invitation.status === "published" && (
              <Link href={`/c/${invitation.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dccdc5] px-4 text-sm font-bold text-[#684f55]">
                Ver convite publicado <ExternalLink className="size-4" />
              </Link>
            )}
            <AdminDeleteInvitationButton id={invitation.id} title={invitation.event_title || invitation.host_name || "Convite"} returnToList />
          </div>
          <p className="mt-3 text-xs leading-5 text-[#947f83]">O administrador não pode editar este convite nesta área. A exclusão exige confirmação e também remove os dados associados ao convite.</p>
        </div>
      </div>

      <section className="rounded-[1.5rem] border border-[#e3d6cf] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-2xl font-bold text-[#351820]">Informações do convite</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Anfitrião / homenageado" value={invitation.host_name} />
          <Field label="Data do evento" value={date} />
          <Field label="Horário" value={invitation.event_time} />
          <Field label="Local" value={invitation.location_name} />
          <Field label="Endereço" value={invitation.address} />
          <Field label="Mensagem do convite" value={invitation.invitation_text} />
          <Field label="Observações para confirmação" value={invitation.rsvp_note} />
          <Field label="Confirmação de presença" value={invitation.rsvp_enabled ? "Ativada" : "Desativada"} />
          <Field label="Lista de presentes" value={invitation.gift_enabled ? "Ativada" : "Desativada"} />
          <Field label="Criado em" value={new Date(invitation.created_at).toLocaleString("pt-BR")} />
          <Field label="Atualizado em" value={new Date(invitation.updated_at).toLocaleString("pt-BR")} />
          <Field label="Endereço interno" value={`/c/${invitation.slug}`} />
        </dl>
      </section>

      <section className="rounded-[1.5rem] border border-[#e3d6cf] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-[#351820]"><Gift className="size-5 text-[#7d1f37]" /> Lista de presentes</h2>
        {giftProfile.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {giftProfile.map((item, index) => (
              <Field key={index} label={item.label} value={item.value} />
            ))}
          </div>
        )}
        {(gifts ?? []).length ? (
          <div className="mt-4 divide-y divide-[#eee4de]">
            {(gifts ?? []).map((gift) => (
              <div key={gift.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div>
                  <p className="font-bold text-[#351820]">{gift.name}</p>
                  {gift.description && <p className="mt-1 text-sm text-[#806e72]">{gift.description}</p>}
                  {gift.price_hint && <p className="mt-1 text-xs text-[#8b767b]">{gift.price_hint}</p>}
                </div>
                <span className="rounded-full bg-[#f4ece6] px-3 py-1.5 text-xs font-bold text-[#684f55]">{gift.reserved ? "Reservado" : "Disponível"}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-[#806e72]">Nenhum presente individual cadastrado.</p>}
      </section>
    </div>
  );
}
