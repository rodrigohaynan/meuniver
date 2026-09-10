import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gift, Palette, PartyPopper, Smartphone, UsersRound } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f4f1]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8 sm:py-4">
        <Link href="/" className="flex items-center">
          <Image
            src="/brand/convniver-logo.png"
            alt="CONVNIVER"
            width={300}
            height={102}
            className="h-auto w-[165px] sm:w-[195px]"
            priority
          />
        </Link>
        <Link href="/entrar" className="rounded-full border border-[#d8c5b8] bg-white px-5 py-2.5 text-sm font-bold text-[#5a3740] shadow-sm transition hover:border-[#aa7280]">
          Entrar
        </Link>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-7 px-5 pb-10 pt-5 sm:px-8 sm:pb-12 sm:pt-7 lg:grid-cols-[1.05fr_.95fr] lg:gap-10 lg:pb-12 lg:pt-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#f4e7e0] px-4 py-2 text-sm font-bold text-[#7d1f37]">
            <PartyPopper className="size-4" /> Seu aniversário, do seu jeito
          </div>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.02] tracking-tight text-[#351820] sm:text-5xl lg:text-6xl">
            Crie um convite bonito, interativo e totalmente personalizado.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#725f63] sm:text-lg">
            Escolha o estilo, mude cores, foto, textos, presentes e confirmação de presença. Compartilhe um único link com seus convidados.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/entrar?modo=cadastro" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#7d1f37] px-6 font-bold text-white shadow-lg shadow-[#7d1f37]/15 transition hover:bg-[#64172b]">
              Criar meu convite <ArrowRight className="size-4" />
            </Link>
            <a href="#recursos" className="inline-flex h-11 items-center rounded-full border border-[#d8c5b8] bg-white px-6 font-bold text-[#5a3740]">
              Ver recursos
            </a>
          </div>
          <p className="mt-3 text-sm text-[#8b777c]">Comece com e-mail, Google ou Facebook.</p>
        </div>

        <div className="relative mx-auto w-full max-w-[500px] lg:mx-0 lg:justify-self-end">
          <div className="absolute -left-8 -top-8 size-36 rounded-full bg-[#efd4db] blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-[#dfd0c6] bg-white/90 p-3 shadow-[0_24px_65px_rgba(79,39,51,.13)] sm:p-4">
            <div className="aspect-[4/3] overflow-hidden rounded-[1.55rem] bg-[#f8eee9]">
              <Image
                src="/brand/convniver-login-hero.png"
                alt="Apresentação do Convniver em uma cena de festa"
                width={1024}
                height={1024}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold text-[#654f54]">
              <div className="rounded-xl bg-[#fff7f3] px-2 py-2.5">🎨 Cores</div>
              <div className="rounded-xl bg-[#fff7f3] px-2 py-2.5">📸 Foto</div>
              <div className="rounded-xl bg-[#fff7f3] px-2 py-2.5">🎁 Presentes</div>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="border-y border-[#eaded7] bg-white/60">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-9 sm:grid-cols-2 sm:px-8 sm:py-10 lg:grid-cols-4">
          {[
            [Palette, "Temas e layouts", "Combinações adultas e infantis prontas para personalizar."],
            [UsersRound, "RSVP organizado", "Adultos e crianças separados, com lista de presença em tempo real."],
            [Gift, "Lista de presentes", "Sugestões, links de compra, imagens e reserva sem duplicidade."],
            [Smartphone, "Feito para celular", "Convites responsivos para compartilhar no WhatsApp."],
          ].map(([Icon, title, description]) => {
            const FeatureIcon = Icon as typeof Palette;
            return (
              <article key={String(title)} className="rounded-[1.5rem] border border-[#eaded7] bg-white p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-[#f4e7e0] text-[#7d1f37]">
                  <FeatureIcon className="size-5" />
                </span>
                <h3 className="mt-3 font-display text-xl font-bold text-[#3c2028]">{String(title)}</h3>
                <p className="mt-2 text-sm leading-6 text-[#77656a]">{String(description)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-12 text-center sm:px-8 sm:py-14">
        <h2 className="font-display text-3xl font-bold text-[#351820] sm:text-4xl">Um convite para cada tipo de festa.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-[#725f63] sm:text-lg">
          Adulto, infantil, clássico, moderno ou divertido. Comece com um modelo e deixe com a sua cara.
        </p>
        <Link href="/entrar?modo=cadastro" className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[#7d1f37] px-7 font-bold text-white">
          Criar conta grátis <ArrowRight className="size-4" />
        </Link>
      </section>
    </main>
  );
}
