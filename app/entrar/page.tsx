import Link from "next/link";
import { Suspense } from "react";
import { PartyPopper } from "lucide-react";
import { AuthCard } from "@/components/auth-card";

export default function LoginPage() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Meu Convite";
  return (
    <main className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_460px]">
        <section className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-2 font-display text-2xl font-bold text-[#4b2230]">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#7d1f37] text-white"><PartyPopper className="size-5" /></span>
            {appName}
          </Link>
          <h2 className="mt-12 max-w-2xl font-display text-6xl font-bold leading-[1.04] text-[#351820]">
            Seu convite começa aqui.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[#756167]">
            Edite cores, layout, foto, presentes, confirmação de presença e publique tudo em um link fácil de compartilhar.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 text-sm font-bold text-[#684f55]">
            <span className="rounded-full bg-white px-4 py-2 shadow-sm">🎨 Temas</span>
            <span className="rounded-full bg-white px-4 py-2 shadow-sm">🎁 Presentes</span>
            <span className="rounded-full bg-white px-4 py-2 shadow-sm">👨‍👩‍👧 RSVP</span>
            <span className="rounded-full bg-white px-4 py-2 shadow-sm">📱 Mobile</span>
          </div>
        </section>
        <section className="flex justify-center">
          <div className="w-full">
            <Link href="/" className="mb-6 inline-flex items-center gap-2 font-display text-xl font-bold text-[#4b2230] lg:hidden">
              <span className="grid size-10 place-items-center rounded-2xl bg-[#7d1f37] text-white"><PartyPopper className="size-5" /></span>
              {appName}
            </Link>
            <Suspense fallback={<div className="h-96 rounded-[2rem] bg-white/70" />}>
              <AuthCard />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}
