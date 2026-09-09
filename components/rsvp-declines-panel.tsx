"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Phone, Trash2, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type RsvpDecline = {
  id: string;
  invitation_id: string;
  contact_name: string;
  whatsapp: string;
  created_at: string;
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function whatsappHref(value: string) {
  const clean = digits(value);
  if (clean.length < 10) return null;
  const withCountry = clean.startsWith("55") ? clean : `55${clean}`;
  return `https://wa.me/${withCountry}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RsvpDeclinesPanel({
  invitationId,
  initialDeclines,
}: {
  invitationId: string;
  initialDeclines: RsvpDecline[];
}) {
  const [declines, setDeclines] = useState(initialDeclines);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let currentHost: HTMLElement | null = null;

    function positionPanel() {
      const headings = Array.from(document.querySelectorAll("h3"));
      const reservationsHeading = headings.find(
        (heading) => heading.textContent?.trim() === "Reservas de presentes",
      );

      if (!reservationsHeading?.parentElement) {
        setPortalTarget(null);
        currentHost = null;
        return;
      }

      let host = document.getElementById("convniver-rsvp-declines-slot");
      if (!host) {
        host = document.createElement("div");
        host.id = "convniver-rsvp-declines-slot";
      }

      if (host.parentElement !== reservationsHeading.parentElement || host.nextSibling !== reservationsHeading) {
        reservationsHeading.parentElement.insertBefore(host, reservationsHeading);
      }

      currentHost = host;
      setPortalTarget(host);
    }

    positionPanel();

    const observer = new MutationObserver(() => {
      positionPanel();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (currentHost?.isConnected) currentHost.remove();
    };
  }, []);

  async function removeDecline(item: RsvpDecline) {
    if (busyId) return;
    const proceed = window.confirm(
      `Excluir a ausência informada por ${item.contact_name}?`,
    );
    if (!proceed) return;

    setBusyId(item.id);
    setMessage("");

    const { error } = await supabase
      .from("rsvp_declines")
      .delete()
      .eq("id", item.id)
      .eq("invitation_id", invitationId);

    if (error) {
      setMessage(error.message);
      setBusyId(null);
      return;
    }

    setDeclines((current) => current.filter((decline) => decline.id !== item.id));
    setMessage("Registro de ausência excluído.");
    setBusyId(null);
  }

  if (!portalTarget) return null;

  return createPortal(
    <section className="mt-7 border-t border-[#eee4de] pt-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f5ece7] text-[#7d1f37]">
            <UserX className="size-5" />
          </span>
          <div>
            <h3 className="font-display text-xl font-bold text-[#351820]">
              Ausências informadas
            </h3>
            <p className="mt-1 text-sm text-[#806e72]">
              Convidados que usaram a opção “Não poderei comparecer”.
            </p>
          </div>
        </div>

        <span className="rounded-full bg-[#f5ece7] px-3 py-1.5 text-xs font-bold text-[#684f55]">
          {declines.length} {declines.length === 1 ? "ausência" : "ausências"}
        </span>
      </div>

      {declines.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-[#d8c7bd] bg-white px-5 py-6 text-center">
          <UserX className="mx-auto size-6 text-[#a58f95]" />
          <p className="mt-2 font-bold text-[#594147]">Nenhuma ausência informada.</p>
          <p className="mt-1 text-sm text-[#806e72]">
            Quando alguém avisar que não poderá comparecer, o registro aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {declines.map((item) => {
            const waHref = whatsappHref(item.whatsapp);
            return (
              <article key={item.id} className="rounded-2xl border border-[#e1d3cb] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#351820]">{item.contact_name}</p>
                    <p className="mt-1 text-xs text-[#8b777d]">
                      Informado em {formatDate(item.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void removeDecline(item)}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" /> Excluir
                  </button>
                </div>

                <div className="mt-3 border-t border-[#f0e7e2] pt-3">
                  {item.whatsapp ? (
                    waHref ? (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-bold text-[#7d1f37]"
                      >
                        <Phone className="size-4" /> {item.whatsapp}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-sm text-[#806e72]">
                        <Phone className="size-4" /> {item.whatsapp}
                      </span>
                    )
                  ) : (
                    <span className="text-sm text-[#9a858a]">WhatsApp não informado</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {message && <p className="mt-4 text-sm font-bold text-[#7c686d]">{message}</p>}
    </section>,
    portalTarget,
  );
}
