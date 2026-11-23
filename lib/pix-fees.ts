// Regras da taxa da Convidata sobre presentes em PIX.
// Arquivo sem dependências de servidor: usado pela API e pelos formulários do convite.

export type PixFeePaidBy = "guest" | "organizer";

export type PixFeeConfig = {
  percent: number;
  paidBy: PixFeePaidBy;
};

export type PixGiftCharge = {
  /** Valor do presente escolhido pelo convidado. */
  amount: number;
  /** Taxa da Convidata (retida via application_fee do Mercado Pago). */
  fee: number;
  /** Valor total do PIX pago pelo convidado. */
  total: number;
  /** Quanto chega ao organizador antes da tarifa do Mercado Pago. */
  organizerReceives: number;
  paidBy: PixFeePaidBy;
  percent: number;
};

export const PIX_GIFT_MIN = 5;
export const PIX_GIFT_MAX = 10000;

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizePixFeeConfig(percent: unknown, paidBy: unknown): PixFeeConfig {
  const parsed = Number(percent);
  return {
    percent: Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0,
    paidBy: paidBy === "organizer" ? "organizer" : "guest",
  };
}

export function computePixGiftCharge(amount: number, config: PixFeeConfig): PixGiftCharge {
  const value = roundMoney(amount);
  const fee = roundMoney(value * (config.percent / 100));
  const guestPaysFee = config.paidBy === "guest";

  return {
    amount: value,
    fee,
    total: guestPaysFee ? roundMoney(value + fee) : value,
    organizerReceives: guestPaysFee ? value : roundMoney(value - fee),
    paidBy: config.paidBy,
    percent: config.percent,
  };
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
