import Link from "next/link";
import { ArrowRight, CalendarDays, CircleDollarSign, Gift, MessageCircleMore, UsersRound } from "lucide-react";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export default async function AdminDashboardPage() {
  const admin = createAdminSupabaseClient();
  const [{ data: rawStats, error: statsError }, { data: invitationRows, error: recentError }] = await Promise.all([
    admin.rpc("admin_home_stats"),
    admin.from("invitations")
      .select("id,status,billing_status,created_at,event_title,host_name,owner_id")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  if (statsError || recentError || !rawStats) {
    throw new Error("Não foi possível carregar o resumo administrativo.");
  }

  type DashboardStats = {
    users: number;
    invitations: number;
    published: number;
    pending_billing: number;
    rsvp_submissions: number;
    guest_count: number;
    declines: number;
    reservations: number;
    pending_reminders: number;
    reminder_rows: number;
    approved_cash: number;
    approved_fees: number;
  };
  const stats = rawStats as DashboardStats;
  const published = Number(stats.published);
  const pendingBilling = Number(stats.pending_billing);
  const guestCount = Number(stats.guest_count);
  const cashVolume = Number(stats.approved_cash);
  const feeVolume = Number(stats.approved_fees);
  const pendingReminders = Number(stats.pending_reminders);
  const recentInvitations = invitationRows ?? [];

  const cards = [
    { label: "Usuários", value: Number(stats.users), icon: UsersRound },
    { label: "Convites", value: Number(stats.invitations), detail: `${published} publicados`, icon: CalendarDays },
    { label: "Convidados confirmados", value: guestCount, detail: `${stats.rsvp_submissions} confirmações`, icon: UsersRound },
    { label: "Ausências", value: Number(stats.declines), icon: MessageCircleMore },
    { label: "Escolhas de presentes", value: Number(stats.reservations), icon: Gift },
    { label: "Cobranças pendentes", value: pendingBilling, icon: CircleDollarSign },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7438]">Administração</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Visão geral</h1>
          <p className="mt-2 text-[#806e72]">Acompanhe operação, usuários, convites, presentes e receita do Convidata.</p>
        </div>
        <Link href="/admin/relatorios" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white">Gerar relatórios <ArrowRight className="size-4" /></Link>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, detail, icon: Icon }) => (
          <article key={label} className="rounded-[1.5rem] border border-[#e3d6cf] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-[#f5ece7] text-[#7d1f37]"><Icon className="size-4.5" /></span>
              {detail && <span className="text-xs font-bold text-[#9a858a]">{detail}</span>}
            </div>
            <p className="mt-5 text-sm font-bold text-[#806e72]">{label}</p>
            <p className="mt-1 font-display text-4xl font-bold text-[#351820]">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-[1.6rem] border border-[#e3d6cf] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-2xl font-bold">Financeiro</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric label="Presentes PIX aprovados" value={money(cashVolume)} />
            <Metric label="Taxa da plataforma" value={money(feeVolume)} />
          </div>
          <Link href="/admin/financeiro" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#7d1f37]">Abrir financeiro <ArrowRight className="size-4" /></Link>
        </article>

        <article className="rounded-[1.6rem] border border-[#e3d6cf] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-2xl font-bold">WhatsApp</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric label="Lembretes na fila" value={String(pendingReminders)} />
            <Metric label="Registros da fila" value={String(stats.reminder_rows)} />
          </div>
          <p className="mt-4 text-sm leading-6 text-[#806e72]">A estrutura de fila já está preparada para a futura integração de mensagens automáticas.</p>
        </article>
      </div>

      <article className="mt-6 overflow-hidden rounded-[1.6rem] border border-[#e3d6cf] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee4de] px-5 py-4 sm:px-6"><h2 className="font-display text-2xl font-bold">Convites recentes</h2><Link href="/admin/convites" className="text-sm font-bold text-[#7d1f37]">Ver todos os convites <ArrowRight className="inline size-4" /></Link></div>
        <div className="divide-y divide-[#f0e7e2]">
          {recentInvitations.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <div>
                <p className="font-bold">{item.event_title || item.host_name || "Convite"}</p>
                <p className="mt-1 text-xs text-[#8b767b]">{new Date(item.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <div className="flex gap-2 text-xs font-bold">
                <span className="rounded-full bg-[#f4ece6] px-3 py-1.5">{item.status === "published" ? "Publicado" : "Rascunho"}</span>
                <span className="rounded-full bg-[#f4ece6] px-3 py-1.5">{item.billing_status}</span>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-[#faf6f3] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#907c81]">{label}</p><p className="mt-2 text-xl font-bold text-[#351820]">{value}</p></div>;
}
