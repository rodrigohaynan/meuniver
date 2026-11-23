"use client";

import { useEffect, useState } from "react";
import {
  PIX_GIFT_MAX,
  PIX_GIFT_MIN,
  computePixGiftCharge,
  formatBRL,
  normalizePixFeeConfig,
  type PixFeeConfig,
} from "@/lib/pix-fees";

/**
 * Carrega a taxa vigente dos presentes em PIX (0% enquanto a Convidata for gratuita).
 * Só consulta quando `enabled` fica verdadeiro (ao abrir o formulário do PIX).
 */
export function usePixFeeConfig(enabled: boolean) {
  const [config, setConfig] = useState<PixFeeConfig | null>(null);
  const shouldLoad = enabled && config === null;

  useEffect(() => {
    if (!shouldLoad) return;
    let active = true;
    fetch("/api/pix-gifts", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active) setConfig(normalizePixFeeConfig(data?.percent ?? 0, data?.paidBy ?? "guest"));
      })
      .catch(() => {
        if (active) setConfig(normalizePixFeeConfig(0, "guest"));
      });
    return () => {
      active = false;
    };
  }, [shouldLoad]);

  return config;
}

/** Resumo exibido abaixo do valor do presente, antes de gerar o PIX. */
export function PixFeeNote({ amount, config }: { amount: number; config: PixFeeConfig | null }) {
  const base = "mt-4 rounded-xl bg-[#faf6f3] px-4 py-3 text-xs leading-5 text-[#76666a]";
  const validAmount = Number.isFinite(amount) && amount >= PIX_GIFT_MIN && amount <= PIX_GIFT_MAX;

  if (!config || config.percent <= 0) {
    return <p className={base}>O PIX vai direto para a conta Mercado Pago do organizador, sem taxa da Convidata.</p>;
  }

  const percentText = `${config.percent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

  if (config.paidBy === "organizer") {
    return (
      <p className={base}>
        A Convidata retém {percentText} do valor do presente como taxa de serviço. O pagamento é processado pelo Mercado Pago.
      </p>
    );
  }

  if (!validAmount) {
    return <p className={base}>Será somada uma taxa de serviço de {percentText} ao valor do presente.</p>;
  }

  const charge = computePixGiftCharge(amount, config);
  return (
    <div className={base}>
      <div className="flex justify-between gap-3"><span>Presente</span><span>{formatBRL(charge.amount)}</span></div>
      <div className="flex justify-between gap-3"><span>Taxa de serviço Convidata ({percentText})</span><span>{formatBRL(charge.fee)}</span></div>
      <div className="mt-1 flex justify-between gap-3 border-t border-[#eaded7] pt-1 font-bold text-[#4a3036]"><span>Total do PIX</span><span>{formatBRL(charge.total)}</span></div>
      <p className="mt-1">O organizador recebe o valor integral do presente.</p>
    </div>
  );
}
