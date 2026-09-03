import Link from "next/link";
import { ArrowRight, Gift, Palette, PartyPopper, Smartphone, UsersRound } from "lucide-react";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Meu Convite";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-[#4b2230]">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#7d1f37] text-white">
            <PartyPopper className="size-5" />
          </span>
          {appName}
        </Link>
        <Link href="/entrar" className="rounded-full border border-[#d8c5b8] bg-white px-5 py-2.5 text-sm font-bold text-[#5a3740] shadow-sm transition hover:border-[#aa7280]">
          Entrar
        </Link>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:pb-24 lg:pt-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#f4e7e0] px-4 py-2 text-sm font-bold text-[#7d1f37]">
            <PartyPopper className="size-4" /> Seu aniversário, do seu jeito
          </div>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-bold leading-[1.02] tracking-tight text-[#351820] sm:text-6xl lg:text-7xl">
            Crie um convite bonito, interativo e totalmente personalizado.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#725f63]">
            Escolha o estilo, mude cores, foto, textos, presentes e confirmação de presença. Compartilhe um único link com seus convidados.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/entrar?modo=cadastro" className="inline-flex h-12 items-center gap-2 rounded-full bg-[#7d1f37] px-6 font-bold text-white shadow-lg shadow-[#7d1f37]/15 transition hover:bg-[#64172b]">
              Criar meu convite <ArrowRight className="size-4" />
            </Link>
            <a href="#recursos" className="inline-flex h-12 items-center rounded-full border border-[#d8c5b8] bg-white px-6 font-bold text-[#5a3740]">
              Ver recursos
            </a>
          </div>
          <p className="mt-4 text-sm text-[#8b777c]">Comece com e-mail, Google ou Facebook.</p>
        </div>

        <div className="relative">
          <div className="absolute -left-8 -top-8 size-36 rounded-full bg-[#efd4db] blur-3xl" />
          <div className="relative rounded-[2.3rem] border border-[#dfd0c6] bg-white/90 p-4 shadow-[0_30px_80px_rgba(79,39,51,.14)] sm:p-6">
            <div className="overflow-hidden rounded-[1.8rem] bg-[#f8eee9]">
              <div className="grid min-h-80 place-items-center p-8 text-center">
                <div>
                  <span className="mx-auto grid size-16 place-items-center rounded-full bg-white text-3xl shadow-sm">🎂</span>
                  <p className="mt-6 text-sm font-bold uppercase tracking-[.18em] text-[#a17536]">Você está convidado</p>
                  <h2 className="mt-3 font-display text-4xl font-bold text-[#421e28]">Aniversário da Sofia</h2>
                  <p className="mt-3 text-[#7b666b]">8 anos • sábado, 19h</p>
                  <div className="mx-auto mt-6 h-px max-w-xs bg-[#dfc9bf]" />
                  <p className="mx-auto mt-6 max-w-md leading-7 text-[#735f64]">
                    Uma tarde cheia de alegria, brincadeiras e pessoas especiais.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs font-bold text-[#654f54]">
              <div className="rounded-2xl bg-[#fff7f3] p-3">🎨 Cores</div>
              <div className="rounded-2xl bg-[#fff7f3] p-3">📸 Foto</div>
              <div className="rounded-2xl bg-[#fff7f3] p-3">🎁 Presentes</div>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="border-y border-[#eaded7] bg-white/60">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
          {[
            [Palette, "Temas e layouts", "Combinações adultas e infantis prontas para personalizar."],
            [UsersRound, "RSVP organizado", "Adultos e crianças separados, com lista de presença em tempo real."],
            [Gift, "Lista de presentes", "Sugestões, links de compra, imagens e reserva sem duplicidade."],
            [Smartphone, "Feito para celular", "Convites responsivos para compartilhar no WhatsApp."],
          ].map(([Icon, title, description]) => {
            const FeatureIcon = Icon as typeof Palette;
            return (
              <article key={String(title)} className="rounded-[1.6rem] border border-[#eaded7] bg-white p-5">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#f4e7e0] text-[#7d1f37]">
                  <FeatureIcon className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold text-[#3c2028]">{String(title)}</h3>
                <p className="mt-2 text-sm leading-6 text-[#77656a]">{String(description)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8">
        <h2 className="font-display text-4xl font-bold text-[#351820]">Um convite para cada tipo de festa.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[#725f63]">
          Adulto, infantil, clássico, moderno ou divertido. Comece com um modelo e deixe com a sua cara.
        </p>
        <Link href="/entrar?modo=cadastro" className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[#7d1f37] px-7 font-bold text-white">
          Criar conta grátis <ArrowRight className="size-4" />
        </Link>
      </section>
    </main>
  );
}
