import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewInvitationForm } from "@/components/new-invitation-form";

export default function NewInvitationPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <Link href="/painel" className="inline-flex items-center gap-2 text-sm font-bold text-[#765f65]"><ArrowLeft className="size-4" /> Voltar</Link>
      <p className="mt-8 text-sm font-bold uppercase tracking-[.16em] text-[#9a7438]">Novo convite</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-[#351820]">Escolha um ponto de partida</h1>
      <p className="mt-2 max-w-2xl text-[#78666b]">Você poderá trocar o tema, cores, layout, foto e todos os textos depois.</p>
      <div className="mt-8"><NewInvitationForm /></div>
    </div>
  );
}
