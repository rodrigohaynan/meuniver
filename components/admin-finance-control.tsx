"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";

export type SiteSettingsForm = {
  invitation_charging_enabled: boolean;
  invitation_price: number;
  free_invites_per_user: number;
  pix_platform_fee_percent: number;
  reminder_feature_enabled: boolean;
};

export type BillingInvitationRow = {
  id: string;
  event_title: string;
  host_name: string;
  billing_status: string;
  billing_amount: number;
  billing_note: string;
  owner_email: string;
  created_at: string;
};

export function AdminFinanceControl({ settings, invitations }: { settings: SiteSettingsForm; invitations: BillingInvitationRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("settings"); setMessage("");
    const payload = {
      invitationChargingEnabled: form.get("invitationChargingEnabled") === "on",
      invitationPrice: Number(form.get("invitationPrice") || 0),
      freeInvitesPerUser: Number(form.get("freeInvitesPerUser") || 0),
      pixPlatformFeePercent: Number(form.get("pixPlatformFeePercent") || 0),
      reminderFeatureEnabled: form.get("reminderFeatureEnabled") === "on",
    };
    const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return setMessage(data.error || "Não foi possível salvar.");
    setMessage("Configurações financeiras atualizadas.");
    router.refresh();
  }

  async function saveBilling(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(id); setMessage("");
    const response = await fetch(`/api/admin/invitations/${id}/billing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: form.get("status"), amount: Number(form.get("amount") || 0), note: form.get("note") }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return setMessage(data.error || "Não foi possível alterar a cobrança.");
    setMessage("Cobrança do convite atualizada.");
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={saveSettings} className="rounded-[1.6rem] border border-[#e3d6cf] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-2xl font-bold">Regras financeiras globais</h2>
        <p className="mt-2 text-sm leading-6 text-[#806e72]">Estas regras passam a valer para novos convites e para presentes em PIX.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-2xl border border-[#e7dcd5] p-4">
            <input name="invitationChargingEnabled" type="checkbox" defaultChecked={settings.invitation_charging_enabled} className="mt-1 size-4 accent-[#7d1f37]" />
            <span><strong className="block">Cobrar por novos convites</strong><span className="mt-1 block text-sm leading-5 text-[#806e72]">Quando ativo, novos convites pagos ficam pendentes até pagamento ou isenção.</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-[#e7dcd5] p-4">
            <input name="reminderFeatureEnabled" type="checkbox" defaultChecked={settings.reminder_feature_enabled} className="mt-1 size-4 accent-[#7d1f37]" />
            <span><strong className="block">Módulo de lembretes WhatsApp</strong><span className="mt-1 block text-sm leading-5 text-[#806e72]">Chave global preparada para a futura integração de envio.</span></span>
          </label>
          <AdminField label="Preço por convite (R$)"><input name="invitationPrice" type="number" min="0" step="0.01" defaultValue={settings.invitation_price} className="input-admin" /></AdminField>
          <AdminField label="Convites gratuitos por usuário"><input name="freeInvitesPerUser" type="number" min="0" step="1" defaultValue={settings.free_invites_per_user} className="input-admin" /></AdminField>
          <AdminField label="Taxa da plataforma em presentes PIX (%)"><input name="pixPlatformFeePercent" type="number" min="0" max="100" step="0.01" defaultValue={settings.pix_platform_fee_percent} className="input-admin" /></AdminField>
        </div>
        <button disabled={busy === "settings"} className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white disabled:opacity-50">{busy === "settings" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar configurações</button>
      </form>

      {message && <p className="mt-4 rounded-xl bg-[#f5ece7] px-4 py-3 text-sm font-bold text-[#684f55]">{message}</p>}

      <div className="mt-6 rounded-[1.6rem] border border-[#e3d6cf] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-2xl font-bold">Cobrança por convite</h2>
        <p className="mt-2 text-sm text-[#806e72]">Você pode confirmar manualmente pagamento, conceder isenção, devolver ou reabrir uma pendência.</p>
        <div className="mt-5 space-y-3">
          {invitations.length === 0 && <p className="rounded-xl bg-[#faf6f3] px-4 py-4 text-sm text-[#806e72]">Nenhum convite cadastrado.</p>}
          {invitations.map((invitation) => (
            <form key={invitation.id} onSubmit={(event) => saveBilling(event, invitation.id)} className="rounded-2xl border border-[#e7dcd5] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-bold">{invitation.event_title || invitation.host_name || "Convite"}</p><p className="mt-1 text-xs text-[#806e72]">{invitation.owner_email || "Sem e-mail"} • {new Date(invitation.created_at).toLocaleDateString("pt-BR")}</p></div>
                <span className="rounded-full bg-[#f4ece6] px-3 py-1.5 text-xs font-bold">{invitation.billing_status}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[170px_160px_1fr_auto]">
                <select name="status" defaultValue={invitation.billing_status} className="input-admin"><option value="free">Gratuito</option><option value="pending">Pendente</option><option value="paid">Pago</option><option value="exempt">Isento</option><option value="refunded">Reembolsado</option></select>
                <input name="amount" type="number" min="0" step="0.01" defaultValue={invitation.billing_amount} className="input-admin" aria-label="Valor" />
                <input name="note" defaultValue={invitation.billing_note} placeholder="Observação financeira" className="input-admin" />
                <button disabled={busy === invitation.id} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#7d1f37] px-4 text-sm font-bold text-white disabled:opacity-50">{busy === invitation.id ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar</button>
              </div>
            </form>
          ))}
        </div>
      </div>

      <style jsx global>{`.input-admin{height:44px;width:100%;border:1px solid #d8c7bd;border-radius:12px;padding:0 12px;background:#fff;outline:none}.input-admin:focus{border-color:#9e6172;box-shadow:0 0 0 2px rgba(158,97,114,.12)}`}</style>
    </div>
  );
}

function AdminField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-bold text-[#594147]">{label}<div className="mt-2">{children}</div></label>;
}
