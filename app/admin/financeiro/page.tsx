import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AdminFinanceControl, type BillingInvitationRow, type SiteSettingsForm } from "@/components/admin-finance-control";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export default async function AdminFinancePage() {
  const admin = createAdminSupabaseClient();
  const [{ data: settingsData }, { data: invitationsData }, { data: profiles }, { data: cashGifts }] = await Promise.all([
    admin.from("site_settings").select("*").eq("id", true).single(),
    admin.from("invitations").select("id,event_title,host_name,owner_id,billing_status,billing_amount,billing_note,created_at").order("created_at", { ascending: false }),
    admin.from("profiles").select("id,email"),
    admin.from("cash_gifts").select("amount,platform_fee,payment_status"),
  ]);

  const settings: SiteSettingsForm = {
    invitation_charging_enabled: Boolean(settingsData?.invitation_charging_enabled),
    invitation_price: Number(settingsData?.invitation_price ?? 0),
    free_invites_per_user: Number(settingsData?.free_invites_per_user ?? 0),
    pix_platform_fee_percent: Number(settingsData?.pix_platform_fee_percent ?? 5),
    reminder_feature_enabled: Boolean(settingsData?.reminder_feature_enabled),
  };

  const emailMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));
  const invitations: BillingInvitationRow[] = (invitationsData ?? []).map((item) => ({
    id: item.id,
    event_title: item.event_title,
    host_name: item.host_name,
    billing_status: item.billing_status,
    billing_amount: Number(item.billing_amount ?? 0),
    billing_note: item.billing_note ?? "",
    owner_email: emailMap.get(item.owner_id) ?? "",
    created_at: item.created_at,
  }));

  const approved = (cashGifts ?? []).filter((gift) => gift.payment_status === "approved");
  const gross = approved.reduce((total, gift) => total + Number(gift.amount || 0), 0);
  const fees = approved.reduce((total, gift) => total + Number(gift.platform_fee || 0), 0);
  const pendingInviteValue = invitations.filter((item) => item.billing_status === "pending").reduce((total, item) => total + item.billing_amount, 0);

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7438]">Administração</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Financeiro</h1>
        <p className="mt-2 text-[#806e72]">Controle preços, cobrança por convites e taxa da plataforma.</p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Volume aprovado em PIX" value={money(gross)} />
        <Metric label="Receita da plataforma em PIX" value={money(fees)} />
        <Metric label="Convites pendentes" value={money(pendingInviteValue)} />
      </div>

      <AdminFinanceControl settings={settings} invitations={invitations} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[1.4rem] border border-[#e3d6cf] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#907c81]">{label}</p><p className="mt-2 font-display text-2xl font-bold">{value}</p></div>;
}
