import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { AccountSettings, type AccountProfile } from "@/components/account-settings";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function MinhaContaPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const metadata = user.user_metadata ?? {};

  const profile: AccountProfile = {
    id: user.id,
    full_name: profileData?.full_name ?? metadata.full_name ?? "",
    sex: profileData?.sex ?? metadata.sex ?? "",
    birth_date: profileData?.birth_date ?? metadata.birth_date ?? "",
    state: profileData?.state ?? metadata.state ?? "",
    city: profileData?.city ?? metadata.city ?? "",
    whatsapp: profileData?.whatsapp ?? metadata.whatsapp ?? "",
    email: profileData?.email ?? user.email ?? "",
    created_at: profileData?.created_at ?? user.created_at,
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
      <div className="mb-6">
        <Link href="/painel" className="inline-flex items-center gap-2 text-sm font-bold text-[#765f65]">
          <ArrowLeft className="size-4" /> Voltar ao painel
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold text-[#351820]">Minha conta</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#806e72]">
          Consulte e atualize seus dados de organizador, e-mail de acesso e senha.
        </p>
      </div>

      <AccountSettings initialProfile={profile} />
    </div>
  );
}
