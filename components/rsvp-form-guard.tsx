"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const NAME_GUIDANCE =
  "Digite somente o nome de uma pessoa por campo, usando apenas letras e espaços. Ex.: Maria da Silva. Não use números, vírgulas, símbolos ou quantidades como “3 adultos”. Para incluir outra pessoa, use o botão + Adicionar pessoa.";

const SHARE_TEXT =
  "Estou usando o Convidata para organizar um momento especial e gostei da praticidade! ✨ Com ele, posso criar convites digitais personalizados, acompanhar as confirmações de presença e organizar a lista de presentes em um só lugar. Conheça também:";

const GENERIC_NAMES = new Set([
  "adulto",
  "adulta",
  "adultos",
  "adultas",
  "crianca",
  "criancas",
  "menino",
  "menina",
  "meninos",
  "meninas",
]);

function formatWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function normalizeNameKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

function hasInvalidNameCharacters(value: string) {
  return /[^\p{L}\s]/u.test(value);
}

function isGenericName(value: string) {
  return GENERIC_NAMES.has(normalizeNameKey(value));
}

function replaceLeadingText(label: HTMLLabelElement, text: string) {
  for (const node of Array.from(label.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      node.textContent = text;
      return;
    }
  }
}

function isRsvpNameInput(target: HTMLInputElement, contactInput: HTMLInputElement) {
  return (
    target === contactInput ||
    /^Outra pessoa\s+\d+/i.test(target.placeholder) ||
    /^Pessoa\s+\d+/i.test(target.placeholder)
  );
}

function configureNameInput(input: HTMLInputElement) {
  input.inputMode = "text";
  input.autocomplete = "name";
  input.title = NAME_GUIDANCE;
  input.dataset.convidataLastValid = input.value;
  if (!input.placeholder) input.placeholder = "Digite somente um nome";
}

function showNameGuidance(input: HTMLInputElement) {
  input.setCustomValidity(NAME_GUIDANCE);
  input.setAttribute("aria-invalid", "true");
  input.reportValidity();
}

function clearNameGuidance(input: HTMLInputElement) {
  input.setCustomValidity("");
  input.removeAttribute("aria-invalid");
}

async function shareConvidata() {
  const url = `${window.location.origin}/?via=indicacao-convidata-3`;

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "Convidata — convites que aproximam",
        text: SHARE_TEXT,
        url,
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  const whatsappText = `${SHARE_TEXT}\n\n${url}`;
  window.open(
    `https://wa.me/?text=${encodeURIComponent(whatsappText)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

export function RsvpFormGuard() {
  useEffect(() => {
    const supabase = createClient();
    let cleanupCurrent: (() => void) | null = null;
    let observer: MutationObserver | null = null;
    let successObserver: MutationObserver | null = null;
    let loggedIn = false;

    function updateSuccessOffer() {
      if (!loggedIn) return;

      const heading = Array.from(document.querySelectorAll("h3")).find(
        (item) => item.textContent?.trim() === "Presença confirmada!",
      );
      if (!(heading instanceof HTMLElement)) return;

      const modal = heading.closest("div.fixed");
      if (!(modal instanceof HTMLElement)) return;

      const promoTitle = Array.from(modal.querySelectorAll("p")).find(
        (item) => item.textContent?.trim() === "Gostou da Convidata?",
      );
      if (!(promoTitle instanceof HTMLParagraphElement)) return;

      const promo = promoTitle.parentElement;
      if (!(promo instanceof HTMLElement)) return;

      promoTitle.textContent = "Está gostando da Convidata? Indique para alguém.";

      const paragraphs = Array.from(promo.querySelectorAll("p"));
      const description = paragraphs.find((item) => item !== promoTitle);
      if (description) {
        description.textContent =
          "Compartilhe com alguém que também queira criar convites e organizar confirmações de forma prática.";
      }

      const accountLink = promo.querySelector<HTMLAnchorElement>(
        'a[href*="/entrar?modo=cadastro"]',
      );
      if (!accountLink) return;

      const shareButton = document.createElement("button");
      shareButton.type = "button";
      shareButton.className = accountLink.className;
      shareButton.textContent = "Compartilhar Convidata";
      shareButton.dataset.convidataShare = "true";
      shareButton.addEventListener("click", () => void shareConvidata());
      accountLink.replaceWith(shareButton);
    }

    void supabase.auth.getSession().then(({ data }) => {
      loggedIn = Boolean(data.session?.user);
      updateSuccessOffer();
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      loggedIn = Boolean(session?.user);
      updateSuccessOffer();
    });

    successObserver = new MutationObserver(() => updateSuccessOffer());
    successObserver.observe(document.body, { childList: true, subtree: true });

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

      configureNameInput(contactInput);
      form.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
        if (isRsvpNameInput(input, contactInput)) configureNameInput(input);
      });

      if (whatsappInput.value) {
        whatsappInput.value = formatWhatsapp(whatsappInput.value);
      }

      const onFocusIn = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!isRsvpNameInput(target, contactInput)) return;
        configureNameInput(target);
      };

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

        if (!isRsvpNameInput(target, contactInput)) return;

        configureNameInput(target);
        const current = target.value;
        const previous = target.dataset.convidataLastValid ?? "";

        if (hasInvalidNameCharacters(current)) {
          target.value = previous;
          showNameGuidance(target);
          return;
        }

        target.dataset.convidataLastValid = current;
        clearNameGuidance(target);
      };

      const onBlur = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!isRsvpNameInput(target, contactInput)) return;
        if (target.value.trim() && isGenericName(target.value)) {
          showNameGuidance(target);
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

        const nameInputs = Array.from(form.querySelectorAll<HTMLInputElement>("input")).filter((input) =>
          isRsvpNameInput(input, contactInput),
        );

        for (const input of nameInputs) {
          const value = input.value.trim();
          if (!value) continue;
          if (hasInvalidNameCharacters(value) || isGenericName(value)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            showNameGuidance(input);
            input.focus();
            return;
          }
          clearNameGuidance(input);
        }
      };

      form.addEventListener("focusin", onFocusIn, true);
      form.addEventListener("input", onInput, true);
      form.addEventListener("blur", onBlur, true);
      form.addEventListener("submit", onSubmit, true);

      cleanupCurrent = () => {
        form.removeEventListener("focusin", onFocusIn, true);
        form.removeEventListener("input", onInput, true);
        form.removeEventListener("blur", onBlur, true);
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
      successObserver?.disconnect();
      cleanupCurrent?.();
      authListener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
