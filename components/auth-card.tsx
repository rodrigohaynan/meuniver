"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, LockKeyhole, Mail } from "lucide-react";

export function AuthCard() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(searchParams.get("modo") === "cadastro" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | "facebook" | null>(null);
  const [message, setMessage] = useState("");

  const supabase = createClient();

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("email");
    setMessage("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/painel`,
          },
        });
        if (error) throw error;
        setMessage("Cadastro criado. Se a confirmação de e-mail estiver ativa, verifique sua caixa de entrada.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/painel";
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setBusy(null);
    }
  }

  async function social(provider: "google" | "facebook") {
    if (busy) return;
    setBusy(provider);
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/painel`,
      },
    });
    if (error) {
      setMessage(error.message);
      setBusy(null);
    }
  }

  return (
    <div className="w-full max-w-md rounded-[2rem] border border-[#dfd0c6] bg-white/95 p-6 shadow-[0_24px_70px_rgba(75,35,47,.12)] sm:p-8">
      <div className="grid grid-cols-2 rounded-full bg-[#f5ece7] p-1">
        <button type="button" onClick={() => setMode("login")} className={`h-10 rounded-full text-sm font-bold transition ${mode === "login" ? "bg-white text-[#6e2037] shadow-sm" : "text-[#806e72]"}`}>
          Entrar
        </button>
        <button type="button" onClick={() => setMode("signup")} className={`h-10 rounded-full text-sm font-bold transition ${mode === "signup" ? "bg-white text-[#6e2037] shadow-sm" : "text-[#806e72]"}`}>
          Criar conta
        </button>
      </div>

      <h1 className="mt-7 font-display text-3xl font-bold text-[#351820]">
        {mode === "login" ? "Bem-vindo de volta" : "Crie seu primeiro convite"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#7c686d]">
        {mode === "login" ? "Entre para editar seus convites e acompanhar respostas." : "Seu painel fica separado e protegido por usuário."}
      </p>

      <div className="mt-6 grid gap-3">
        <button type="button" onClick={() => void social("google")} disabled={Boolean(busy)} className="flex h-12 items-center justify-center gap-3 rounded-xl border border-[#d9cbc3] bg-white font-bold text-[#4f4044] transition hover:bg-[#fffaf7] disabled:opacity-60">
          <span className="grid size-6 place-items-center rounded-full border text-xs font-black">G</span>
          {busy === "google" ? "Abrindo Google…" : "Continuar com Google"}
        </button>
        <button type="button" onClick={() => void social("facebook")} disabled={Boolean(busy)} className="flex h-12 items-center justify-center gap-3 rounded-xl border border-[#d9cbc3] bg-white font-bold text-[#4f4044] transition hover:bg-[#fffaf7] disabled:opacity-60">
          <span className="grid size-6 place-items-center rounded-full bg-[#1877f2] text-xs font-black text-white">f</span>
          {busy === "facebook" ? "Abrindo Facebook…" : "Continuar com Facebook"}
        </button>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[.12em] text-[#aa999d]">
        <span className="h-px flex-1 bg-[#eaded7]" /> ou <span className="h-px flex-1 bg-[#eaded7]" />
      </div>

      <form onSubmit={submitEmail} className="space-y-4">
        <label className="block">
          <span className="text-sm font-bold text-[#594147]">E-mail</span>
          <div className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-[#d9cbc3] bg-white px-3 focus-within:border-[#a96b7b] focus-within:ring-2 focus-within:ring-[#a96b7b]/15">
            <Mail className="size-4 text-[#9b858b]" />
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="min-w-0 flex-1 outline-none" placeholder="voce@email.com" />
          </div>
        </label>
        <label className="block">
          <span className="text-sm font-bold text-[#594147]">Senha</span>
          <div className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-[#d9cbc3] bg-white px-3 focus-within:border-[#a96b7b] focus-within:ring-2 focus-within:ring-[#a96b7b]/15">
            <LockKeyhole className="size-4 text-[#9b858b]" />
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="min-w-0 flex-1 outline-none" placeholder="••••••••" />
          </div>
        </label>
        <button disabled={Boolean(busy)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7d1f37] font-bold text-white transition hover:bg-[#64172b] disabled:opacity-60">
          {busy === "email" && <Loader2 className="size-4 animate-spin" />}
          {mode === "login" ? "Entrar no painel" : "Criar minha conta"}
        </button>
      </form>

      {message && <p className="mt-4 rounded-xl bg-[#fff5ed] px-4 py-3 text-sm leading-5 text-[#77543c]">{message}</p>}
    </div>
  );
}
