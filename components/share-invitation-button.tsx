"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, MessageCircle, RotateCcw, Share2, X } from "lucide-react";
import {
  defaultShareMessage,
  invitationShareUrl,
  whatsappShareHref,
  type ShareableInvitation,
} from "@/lib/invitation-share";

const STORAGE_PREFIX = "convidata.share-message.";

function readSavedMessage(id: string) {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + id);
  } catch {
    return null;
  }
}

function writeSavedMessage(id: string, message: string | null) {
  try {
    if (message === null) window.localStorage.removeItem(STORAGE_PREFIX + id);
    else window.localStorage.setItem(STORAGE_PREFIX + id, message);
  } catch {
    // Navegação privada ou armazenamento bloqueado: segue sem lembrar a mensagem.
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Botão "Enviar no WhatsApp": abre uma janela com a mensagem pronta (título,
 * data, local e link), que o organizador pode ajustar antes de enviar.
 */
export function ShareInvitationButton({
  invitation,
  size = "md",
  className = "",
}: {
  invitation: ShareableInvitation;
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const sizeClass = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#1f8f4e] font-bold text-white shadow-sm transition hover:bg-[#187a42] ${sizeClass} ${className}`}
        aria-haspopup="dialog"
      >
        <MessageCircle className={size === "sm" ? "size-3.5" : "size-4"} />
        Enviar no WhatsApp
      </button>
      {open && <ShareDialog invitation={invitation} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareDialog({ invitation, onClose }: { invitation: ShareableInvitation; onClose: () => void }) {
  const url = useMemo(() => invitationShareUrl(invitation), [invitation]);
  const standardMessage = useMemo(() => defaultShareMessage(invitation, url), [invitation, url]);
  // A janela só existe no navegador (aberta por clique), então ler o localStorage aqui é seguro.
  const [message, setMessage] = useState(() => readSavedMessage(invitation.id) ?? standardMessage);
  const [copied, setCopied] = useState<"message" | "link" | null>(null);
  const [canNativeShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");

  const customized = message !== standardMessage;
  const messageWithLink = message.includes(url) || message.includes(`/c/${invitation.slug}`) ? message : `${message.trim()}\n\n${url}`;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function updateMessage(value: string) {
    setMessage(value);
    writeSavedMessage(invitation.id, value === standardMessage ? null : value);
  }

  function restoreDefault() {
    setMessage(standardMessage);
    writeSavedMessage(invitation.id, null);
  }

  async function copy(kind: "message" | "link") {
    if (await copyText(kind === "message" ? messageWithLink : url)) {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: invitation.event_title || "Convite", text: messageWithLink });
    } catch {
      // Usuário cancelou o compartilhamento.
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.8rem] bg-white p-5 text-[#351820] shadow-2xl sm:rounded-[1.8rem] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#1f8f4e]">Compartilhar convite</p>
            <h3 id="share-title" className="mt-1 font-display text-2xl font-bold">Enviar no WhatsApp</h3>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f7efeb] text-[#806e72]" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>

        <label className="mt-4 block text-sm font-bold" htmlFor="share-message">
          Mensagem
        </label>
        <textarea
          id="share-message"
          value={message}
          onChange={(event) => updateMessage(event.target.value)}
          rows={9}
          className="mt-2 w-full resize-y rounded-2xl border border-[#d8c7bd] bg-[#fbf8f6] px-4 py-3 text-sm leading-6 outline-none focus:border-[#1f8f4e]"
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[#806e72]">
          <span>Use *texto* para negrito no WhatsApp.</span>
          {customized && (
            <button type="button" onClick={restoreDefault} className="inline-flex items-center gap-1 font-bold text-[#7d1f37]">
              <RotateCcw className="size-3.5" /> Restaurar mensagem padrão
            </button>
          )}
        </div>

        <a
          href={whatsappShareHref(messageWithLink)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1f8f4e] px-5 text-base font-bold text-white shadow-sm transition hover:bg-[#187a42]"
        >
          <MessageCircle className="size-5" /> Abrir WhatsApp e escolher contatos
        </a>

        <div className={`mt-3 grid gap-2 ${canNativeShare ? "grid-cols-3" : "grid-cols-2"}`}>
          <button type="button" onClick={() => void copy("message")} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-[#d8c7bd] px-3 text-sm font-bold text-[#684f55]">
            {copied === "message" ? <Check className="size-4 text-emerald-700" /> : <Copy className="size-4" />}
            {copied === "message" ? "Copiada" : "Copiar texto"}
          </button>
          <button type="button" onClick={() => void copy("link")} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-[#d8c7bd] px-3 text-sm font-bold text-[#684f55]">
            {copied === "link" ? <Check className="size-4 text-emerald-700" /> : <Link2 className="size-4" />}
            {copied === "link" ? "Copiado" : "Copiar link"}
          </button>
          {canNativeShare && (
            <button type="button" onClick={() => void nativeShare()} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-[#d8c7bd] px-3 text-sm font-bold text-[#684f55]">
              <Share2 className="size-4" /> Outros apps
            </button>
          )}
        </div>

        <p className="mt-4 rounded-xl bg-[#f3faf5] px-4 py-3 text-xs leading-5 text-[#3e6b4f]">
          Dica: no WhatsApp, espere a foto do convite aparecer acima da mensagem antes de tocar em enviar. Para mandar a vários contatos de uma vez, use uma lista de transmissão ou grupo.
        </p>
      </div>
    </div>
  );
}
