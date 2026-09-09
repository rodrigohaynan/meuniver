import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";

export default function LoginPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8f4f1]">
      <div className="mx-auto grid w-full max-w-[1480px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(520px,600px)] lg:items-start lg:gap-8 lg:px-8 lg:py-6 xl:gap-10">
        <section className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
          <div className="flex min-h-[calc(100vh-3rem)] flex-col">
            <Link href="/" className="inline-flex w-fit items-center">
              <Image
                src="/brand/convniver-logo.png"
                alt="CONVNIVER"
                width={320}
                height={109}
                className="h-auto w-[190px] xl:w-[210px]"
                priority
              />
            </Link>

            <div className="mt-6 overflow-hidden rounded-[1.8rem] border border-[#e0d3cb] bg-white shadow-[0_18px_55px_rgba(74,36,47,.09)]">
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#f4e8e2]">
                <Image
                  src="/brand/convniver-login-hero.png"
                  alt="Imagem de apresentação da plataforma Convniver"
                  fill
                  sizes="(min-width: 1280px) 760px, 55vw"
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            <div className="mt-6 max-w-2xl pb-6">
              <h2 className="font-display text-4xl font-bold leading-[1.05] text-[#351820] xl:text-5xl">
                Seu convite começa aqui.
              </h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-[#756167]">
                Edite cores, layout, foto, presentes, confirmação de presença e publique tudo em um link fácil de compartilhar.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-[#684f55] xl:text-sm">
                <span className="rounded-full bg-white px-3.5 py-2 shadow-sm">🎨 Temas</span>
                <span className="rounded-full bg-white px-3.5 py-2 shadow-sm">🎁 Presentes</span>
                <span className="rounded-full bg-white px-3.5 py-2 shadow-sm">👨‍👩‍👧 RSVP</span>
                <span className="rounded-full bg-white px-3.5 py-2 shadow-sm">📱 Mobile</span>
              </div>
            </div>
          </div>
        </section>

        <section className="flex w-full justify-center lg:justify-end">
          <div className="w-full max-w-[600px]">
            <Link href="/" className="mb-5 inline-flex items-center lg:hidden">
              <Image
                src="/brand/convniver-logo.png"
                alt="CONVNIVER"
                width={260}
                height={89}
                className="h-auto w-[175px]"
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
