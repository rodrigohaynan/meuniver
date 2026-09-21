import { CalendarHeart, CheckCircle2, Heart } from "lucide-react";

export function EventHero({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_14%_10%,#f6dce3,transparent_48%),linear-gradient(145deg,#fdf9f4,#f4e7e0)] px-6 text-center ${compact ? "py-5" : "py-8"}`}>
      <span className="grid size-12 place-items-center rounded-full bg-white/90 text-[#7d1f37] shadow-sm">
        <CalendarHeart className="size-6" />
      </span>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[.20em] text-[#956675]">Você está convidado</p>
      <p className={`mt-3 font-display font-bold leading-tight text-[#51202f] ${compact ? "text-[31px]" : "text-[32px] sm:text-[40px]"}`}>
        Um dia para<br />celebrar juntos
      </p>
      <p className="mt-3 max-w-xs text-sm leading-6 text-[#806a70]">Uma data especial merece pessoas especiais por perto.</p>
      <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#7d1f37] px-5 py-2.5 text-sm font-bold text-white">
        <CheckCircle2 className="size-4" /> Confirmar presença
      </span>
      <p className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#886a72]">
        <Heart className="size-3.5 fill-current text-[#c78798]" /> Criado com carinho na Convidata
      </p>
    </div>
  );
}
