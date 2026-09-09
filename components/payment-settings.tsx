"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleDollarSign, Loader2, RefreshCw, Unplug } from "lucide-react";

export function PaymentSettings() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/mercadopago/status", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Não foi possível consultar a conexão.");
      setConnected(Boolean(data.connected));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível consultar a conexão.");
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    const proceed = window.confirm("Desconectar o Mercado Pago? Novos presentes em PIX deixarão de ser oferecidos nos seus convites.");
    if (!proceed) return;

    setLoading(true);
    try {
      const response = await fetch("/api/mercadopago/status", { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data?.error || "Não foi possível desconectar.");
      setConnected(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível desconectar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-[#e4d8d0] bg-white p-6 shadow-[0_14px_45px_rgba(83,48,58,.06)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <span className="grid size-12 place-items-center rounded-2xl bg-[#f4e7e0] text-[#7d1f37]">
              <CircleDollarSign className="size-6" />
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold text-[#351820]">Presentes em PIX</h2>
            <p className="mt-2 text-sm leading-6 text-[#78666b]">
              Conecte sua conta Mercado Pago para que convidados que não possam comparecer possam enviar um presente em PIX. O CONVNIVER cobra 5% do valor do presente por meio do split automático do marketplace.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#d8c7bd] px-4 text-sm font-bold text-[#684f55] disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 rounded-2xl bg-[#faf6f3] px-4 py-4 text-sm font-bold text-[#725f63]">
            <Loader2 className="size-4 animate-spin" /> Verificando sua conta…
          </div>
        ) : connected ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
              <div>
                <p className="font-bold text-emerald-900">Mercado Pago conectado</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  Seus convites publicados podem oferecer o presente em PIX automaticamente.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void disconnect()}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-emerald-300 bg-white px-4 text-xs font-bold text-emerald-900"
            >
              <Unplug className="size-3.5" /> Desconectar
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-[#e3d6ce] bg-[#faf6f3] p-5">
            <p className="font-bold text-[#4e343a]">Conecte sua conta para começar</p>
            <p className="mt-1 text-sm leading-6 text-[#76666a]">
              Você será levado ao Mercado Pago para autorizar o CONVNIVER. O site não recebe nem armazena sua senha do Mercado Pago.
            </p>
            <a
              href="/api/mercadopago/connect"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-[#7d1f37] px-5 text-sm font-bold text-white"
            >
              Conectar Mercado Pago
            </a>
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </section>

      <section className="rounded-[1.7rem] border border-[#e4d8d0] bg-[#fffdfa] p-5 text-sm leading-6 text-[#6f5d62] sm:p-6">
        <p className="font-bold text-[#4e343a]">Como o dinheiro é dividido</p>
        <p className="mt-2">
          O pagamento é criado na conta Mercado Pago do organizador usando o recurso de split de marketplace. O CONVNIVER recebe 5% como taxa da plataforma. As tarifas de processamento do Mercado Pago são cobradas conforme as condições da conta do organizador, portanto o valor líquido recebido pelo organizador pode ser menor que 95% do valor bruto.
        </p>
      </section>
    </div>
  );
}
