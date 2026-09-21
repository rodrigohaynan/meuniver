export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap" aria-label="Convidata">
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        fill="none"
        className={compact ? "size-9 shrink-0" : "size-10 shrink-0 sm:size-11"}
      >
        <rect width="48" height="48" rx="15" fill="#7D1F37" />
        <path d="M11.5 18.5 24 27l12.5-8.5" stroke="#FFF9F4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="11.5" y="17" width="25" height="17" rx="3.6" stroke="#FFF9F4" strokeWidth="2.4" />
        <path d="m19.5 26-7 6.2m16-6.2 7 6.2" stroke="#FFF9F4" strokeWidth="2" strokeLinecap="round" />
        <path d="m35.6 8.5 1.3 3.6 3.6 1.3-3.6 1.3-1.3 3.6-1.3-3.6-3.6-1.3 3.6-1.3 1.3-3.6Z" fill="#F0C88C" />
      </svg>
      <span className={`font-display font-bold leading-none tracking-[-.045em] text-[#51202F] ${compact ? "text-[25px] sm:text-[28px]" : "text-[29px] sm:text-[34px]"}`}>
        convidata<span className="text-[#BA795A]">.</span>
      </span>
    </span>
  );
}
