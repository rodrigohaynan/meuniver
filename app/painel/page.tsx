import Link from "next/link";
import { ArrowUpRight, CalendarDays, Plus, Settings2 } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Invitation } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("invitations").select("*").order("created_at", { ascending: false });
  const invitations = (data ?? []) as Invitation[];

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.16em] text-[#9a7438]">Painel</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-[#351820]">Meus convites</h1>
          <p className="mt-2 text-[#78666b]">Crie, personalize, publique e acompanhe seus aniversários.</p>
        </div>
        <Link href="/painel/novo" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white">
          <Plus className="size-4" /> Novo convite
        </Link>
      </div>

      {invitations.length === 0 ? (
        <section className="mt-8 rounded-[2rem] border border-dashed border-[#d6c4ba] bg-white px-6 py-16 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f4e7e0] text-[#7d1f37]"><CalendarDays className="size-6" /></span>
          <h2 className="mt-5 font-display text-2xl font-bold">Você ainda não criou nenhum convite.</h2>
          <p className="mx-auto mt-2 max-w-lg text-[#806e72]">Escolha um modelo adulto ou infantil e personalize em poucos minutos.</p>
          <Link href="/painel/novo" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white"><Plus className="size-4" /> Criar agora</Link>
        </section>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {invitations.map((invitation) => (
            <article key={invitation.id} className="overflow-hidden rounded-[1.7rem] border border-[#e1d3cb] bg-white shadow-sm">
              <div className="h-36 bg-[#f3e8e2]" style={invitation.hero_image_url ? { backgroundImage: `url("${invitation.hero_image_url}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                {!invitation.hero_image_url && <div className="grid h-full place-items-center text-4xl">🎂</div>}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${invitation.status === "published" ? "bg-[#e5f3e8] text-[#326443]" : "bg-[#f4ece6] text-[#7b665c]"}`}>
                    {invitation.status === "published" ? "Publicado" : "Rascunho"}
                  </span>
                  <span className="text-xs font-bold text-[#9a858a]">{invitation.event_date ? new Date(`${invitation.event_date}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data"}</span>
                </div>
                <h2 className="mt-4 font-display text-2xl font-bold text-[#3a1d25]">{invitation.event_title}</h2>
                <p className="mt-1 text-sm text-[#806e72]">{invitation.host_name} • {invitation.age} anos</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={`/painel/convites/${invitation.id}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#7d1f37] px-4 text-sm font-bold text-white"><Settings2 className="size-4" /> Editar</Link>
                  {invitation.status === "published" && (
                    <Link href={`/c/${invitation.slug}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dac9bf] px-4 text-sm font-bold text-[#684f55]">
                      Abrir <ArrowUpRight className="size-4" />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
