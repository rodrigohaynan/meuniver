"use client";

import { useEffect } from "react";

function formatWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function stripDigitsFromName(value: string) {
  return value.replace(/[0-9]/g, "");
}

function replaceLeadingText(label: HTMLLabelElement, text: string) {
  for (const node of Array.from(label.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      node.textContent = text;
      return;
    }
  }
}

export function RsvpFormGuard() {
  useEffect(() => {
    let cleanupCurrent: (() => void) | null = null;
    let observer: MutationObserver | null = null;

    function attach() {
      const heading = Array.from(document.querySelectorAll("h2")).find((item) =>
        item.textContent?.includes("Confirme sua presença"),
      );
      const section = heading?.closest("section");
      const form = section?.querySelector("form");
      if (!(form instanceof HTMLFormElement)) return false;

      const labels = Array.from(form.querySelectorAll("label"));
      const contactLabel = labels.find((item) =>
        item.textContent?.trim().startsWith("Quem está confirmando?"),
      );
      const whatsappLabel = labels.find((item) =>
        item.textContent?.trim().startsWith("WhatsApp"),
      );

      const contactInput = contactLabel?.querySelector("input") ?? null;
      const whatsappInput = whatsappLabel?.querySelector("input") ?? null;

      if (!(contactInput instanceof HTMLInputElement) || !(whatsappInput instanceof HTMLInputElement)) {
        return false;
      }

      replaceLeadingText(whatsappLabel as HTMLLabelElement, "WhatsApp (obrigatório)");
      whatsappInput.required = true;
      whatsappInput.inputMode = "tel";
      whatsappInput.placeholder = "(67) 99999-9999";
      whatsappInput.maxLength = 15;
      whatsappInput.pattern = "\\(\\d{2}\\) \\d{5}-\\d{4}";
      whatsappInput.title = "Informe no formato (XX) XXXXX-XXXX";
      whatsappInput.autocomplete = "tel-national";

      if (whatsappInput.value) {
        whatsappInput.value = formatWhatsapp(whatsappInput.value);
      }

      const onInput = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;

        if (target === whatsappInput) {
          const next = formatWhatsapp(target.value);
          if (target.value !== next) target.value = next;
          const valid = next.replace(/\D/g, "").length === 11;
          target.setCustomValidity(next && !valid ? "Informe o WhatsApp no formato (XX) XXXXX-XXXX." : "");
          return;
        }

        const isNameInput =
          target === contactInput ||
          /^Outra pessoa\s+\d+/i.test(target.placeholder) ||
          /^Pessoa\s+\d+/i.test(target.placeholder);

        if (isNameInput) {
          const next = stripDigitsFromName(target.value);
          if (target.value !== next) target.value = next;
          target.inputMode = "text";
          target.autocomplete = "name";
        }
      };

      const onSubmit = (event: Event) => {
        const whatsappDigits = whatsappInput.value.replace(/\D/g, "");
        if (whatsappDigits.length !== 11) {
          whatsappInput.setCustomValidity("Informe o WhatsApp no formato (XX) XXXXX-XXXX.");
          event.preventDefault();
          event.stopImmediatePropagation();
          whatsappInput.reportValidity();
          whatsappInput.focus();
          return;
        }
        whatsappInput.setCustomValidity("");
      };

      form.addEventListener("input", onInput, true);
      form.addEventListener("submit", onSubmit, true);

      cleanupCurrent = () => {
        form.removeEventListener("input", onInput, true);
        form.removeEventListener("submit", onSubmit, true);
      };

      return true;
    }

    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) {
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      cleanupCurrent?.();
    };
  }, []);

  return null;
}
