import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";

export default function LoginPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8f4f1]">
      <div className="mx-auto grid w-full max-w-[1420px] gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(520px,600px)] lg:items-start lg:gap-8 lg:px-8 lg:py-4 xl:gap-9">
        <section className="hidden lg:block lg:self-start">
          <div className="flex flex-col">
            <Link href="/" className="inline-flex w-fit items-center">
              <Image
                src="/brand/convniver-logo.png"
                alt="CONVNIVER"
                width={320}
                height={109}
                className="h-auto w-[170px] xl:w-[190px]"
                priority
              />
            </Link>

            <div className="mt-4 overflow-hidden rounded-[1.7rem] border border-[#e0d3cb] bg-white shadow-[0_16px_45px_rgba(74,36,47,.08)]">
              <div className="relative aspect-[16/8.7] w-full max-h-[330px] overflow-hidden bg-[#f4e8e2]">
                <Image
                  src="/brand/convniver-login-hero.png"
                  alt="Imagem de apresentação da plataforma Convniver"
                  fill
                  sizes="(min-width: 1280px) 720px, 55vw"
                  className="object-cover object-center"
                  priority
                />
              </div>
            </div>

            <div className="mt-4 max-w-2xl pb-4">
              <h2 className="font-display text-[34px] font-bold leading-[1.02] text-[#351820] xl:text-[40px]">
                Seu convite começa aqui.
              </h2>
              <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#756167]">
                Edite cores, layout, foto, presentes, confirmação de presença e publique tudo em um link fácil de compartilhar.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#684f55]">
                <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">🎨 Temas</span>
                <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">🎁 Presentes</span>
                <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">👨‍👩‍👧 RSVP</span>
                <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">📱 Mobile</span>
              </div>
            </div>
          </div>
        </section>

        <section className="flex w-full justify-center lg:justify-end lg:self-start">
          <div className="w-full max-w-[600px]">
            <Link href="/" className="mb-4 inline-flex items-center lg:hidden">
              <Image
                src="/brand/convniver-logo.png"
                alt="CONVNIVER"
                width={260}
                height={89}
                className="h-auto w-[170px]"
                priority
              />
            </Link>

            <Suspense fallback={<div className="h-96 rounded-[1.8rem] bg-white/70" />}>
              <AuthCard />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}
