"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Clipboard, ExternalLink, Loader2, X } from "lucide-react";
import { formatBRL } from "@/lib/pix-fees";

type BillingPayment = {
  id: string;
  status: string;
  approved: boolean;
  amount: number;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiresAt: string | null;
};

type BillingResponse = {
  ok?: boolean;
  error?: string;
  billingStatus?: string;
  payment?: BillingPayment | null;
};

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

const POLL_MS = 4000;

/**
 * Pagamento da publicação: aparece quando o organizador já montou e conferiu o
 * convite e clica em "Publicar". Ao confirmar o PIX, `onPaid` publica o convite.
 */
export function InvitationBillingModal({
  invitationId,
  amount,
  onClose,
  onPaid,
}: {
  invitationId: string;
  amount: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<BillingPayment | null>(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  // Garante que a publicação seja disparada uma única vez, mesmo com consultas simultâneas.
  const onPaidRef = useRef(onPaid);
  const doneRef = useRef(false);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  function confirmPaid() {
    if (doneRef.current) return;
    doneRef.current = true;
    setPaid(true);
    onPaidRef.current();
  }

  // Consulta a confirmação do PIX enquanto o QR Code estiver na tela.
  const waiting = Boolean(payment?.qrCode) && !paid;
  useEffect(() => {
    if (!waiting) return;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/billing/invitations/${encodeURIComponent(invitationId)}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as BillingResponse;
        if (!active || !response.ok) return;
        if (data.billingStatus === "paid" || data.billingStatus === "exempt" || data.payment?.approved) {
          confirmPaid();
        } else if (data.payment && ["rejected", "cancelled", "expired"].includes(data.payment.status)) {
          setPayment(null);
          setError("O PIX expirou ou foi cancelado. Gere um novo código para continuar.");
        }
      } catch {
        // Falha momentânea de rede: tenta de novo no próximo ciclo.
      }
    }, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [waiting, invitationId]);

  async function generatePix(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/billing/invitations/${encodeURIComponent(invitationId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payerCpf: cpf.replace(/\D/g, "") }),
      });
      const data = (await response.json().catch(() => ({}))) as BillingResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível gerar o PIX.");

      if (data.billingStatus === "paid" || data.billingStatus === "exempt" || data.billingStatus === "free") {
        confirmPaid();
        return;
      }
      setPayment(data.payment ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível gerar o PIX.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!payment?.qrCode) return;
    try {
      await navigator.clipboard.writeText(payment.qrCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar automaticamente. Use o QR Code.");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="billing-title">
      <div className="relative mx-auto mt-10 w-full max-w-md rounded-[1.8rem] bg-white p-6 text-[#351820] shadow-2xl sm:p-7">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-[#f7efeb] text-[#806e72]" aria-label="Fechar">
          <X className="size-4" />
        </button>

        {paid ? (
          <div className="text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-8" /></span>
            <h3 id="billing-title" className="mt-4 font-display text-3xl font-bold">Pagamento confirmado!</h3>
            <p className="mt-2 text-sm leading-6 text-[#806e72]">Estamos publicando o seu convite.</p>
          </div>
        ) : !payment ? (
          <form onSubmit={generatePix}>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#9a7438]">Seu convite está pronto</p>
            <h3 id="billing-title" className="mt-2 font-display text-2xl font-bold">Publique por {formatBRL(amount)}</h3>
            <p className="mt-2 text-sm leading-6 text-[#806e72]">
              Pagamento único por PIX. Assim que for confirmado, o convite é publicado e o link fica pronto para compartilhar.
            </p>
            <label className="mt-5 block text-sm font-bold">
              CPF de quem vai pagar
              <input value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} required inputMode="numeric" placeholder="000.000.000-00" className="mt-2 h-11 w-full rounded-xl border border-[#d8c7bd] px-3 outline-none" />
            </label>
            {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white disabled:opacity-60">
              {busy && <Loader2 className="size-4 animate-spin" />} Gerar PIX de {formatBRL(amount)}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <h3 id="billing-title" className="font-display text-2xl font-bold">Pague o PIX</h3>
            <p className="mt-2 text-sm leading-6 text-[#806e72]">
              Valor: <strong>{formatBRL(payment.amount)}</strong>. A confirmação aparece aqui automaticamente.
            </p>
            {payment.qrCodeBase64 && (
              <img src={`data:image/png;base64,${payment.qrCodeBase64}`} alt="QR Code PIX" className="mx-auto mt-5 size-64 max-w-full rounded-2xl border border-[#eaded7] bg-white p-3" />
            )}
            {payment.qrCode && (
              <button type="button" onClick={() => void copyCode()} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-[#d8c7bd] px-5 font-bold text-[#684f55]">
                <Clipboard className="size-4" /> {copied ? "Copiado" : "Copiar código PIX"}
              </button>
            )}
            {payment.ticketUrl && (
              <a href={payment.ticketUrl} target="_blank" rel="noreferrer" className="mx-auto mt-3 block w-fit text-sm font-bold text-[#7d1f37]">
                Abrir pagamento <ExternalLink className="ml-1 inline size-3.5" />
              </a>
            )}
            <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#9a7438]"><Loader2 className="size-3.5 animate-spin" /> Aguardando pagamento…</p>
            {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
