import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f8f4f1]">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_460px]">
        <section className="hidden lg:block">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/brand/convniver-logo.png"
              alt="CONVNIVER"
              width={320}
              height={109}
              className="h-auto w-[220px]"
              priority
            />
          </Link>

          <div className="mt-10 overflow-hidden rounded-[2rem] border border-[#e0d3cb] bg-white shadow-[0_20px_70px_rgba(74,36,47,.10)]">
            <Image
              src="/brand/convniver-login-hero.png"
              alt="Imagem de apresentação da plataforma Convniver"
              width={1024}
              height={1024}
              className="h-auto w-full"
              priority
            />
          </div>

          <h2 className="mt-10 max-w-2xl font-display text-6xl font-bold leading-[1.04] text-[#351820]">
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
            <Link href="/" className="mb-6 inline-flex items-center lg:hidden">
              <Image
                src="/brand/convniver-logo.png"
                alt="CONVNIVER"
                width={260}
                height={89}
                className="h-auto w-[185px]"
                priority
              />
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
