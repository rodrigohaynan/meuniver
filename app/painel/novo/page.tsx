import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewInvitationForm } from "@/components/new-invitation-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function NewInvitationPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: settings }, { count: invitationCount }] = await Promise.all([
    supabase.from("site_settings").select("invitation_charging_enabled,invitation_price,free_invites_per_user").eq("id", true).maybeSingle(),
    supabase.from("invitations").select("id", { count: "exact", head: true }),
  ]);

  const enabled = Boolean(settings?.invitation_charging_enabled) && Number(settings?.invitation_price ?? 0) > 0;
  const price = Number(settings?.invitation_price ?? 0);
  const freeLimit = Number(settings?.free_invites_per_user ?? 0);
  const existing = invitationCount ?? 0;
  const willCharge = enabled && !(freeLimit > 0 && existing < freeLimit);
  const billingNotice = willCharge
    ? `Este novo convite terá cobrança de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price)}. Você poderá editá-lo normalmente, mas a publicação dependerá da liberação financeira.`
    : enabled && freeLimit > 0
      ? `Este convite está dentro da franquia gratuita de ${freeLimit} convite(s) da sua conta.`
      : "";

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <Link href="/painel" className="inline-flex items-center gap-2 text-sm font-bold text-[#765f65]"><ArrowLeft className="size-4" /> Voltar</Link>
      <p className="mt-8 text-sm font-bold uppercase tracking-[.16em] text-[#9a7438]">Novo convite</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-[#351820]">Escolha um ponto de partida</h1>
      <p className="mt-2 max-w-2xl text-[#78666b]">Você poderá trocar o tema, cores, layout, foto e todos os textos depois.</p>
      <div className="mt-8"><NewInvitationForm billingNotice={billingNotice} billingRequired={willCharge} /></div>
    </div>
  );
}
