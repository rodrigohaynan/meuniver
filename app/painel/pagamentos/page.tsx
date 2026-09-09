import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PaymentSettings } from "@/components/payment-settings";

export default function PaymentsSettingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <Link href="/painel" className="inline-flex items-center gap-2 text-sm font-bold text-[#7d1f37]">
        <ArrowLeft className="size-4" /> Voltar ao painel
      </Link>
      <div className="mt-6">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-[#9a7438]">Financeiro</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-[#351820]">Recebimentos</h1>
        <p className="mt-2 text-[#78666b]">Configure o recebimento de presentes em PIX nos seus convites.</p>
      </div>
      <div className="mt-7"><PaymentSettings /></div>
    </div>
  );
}
