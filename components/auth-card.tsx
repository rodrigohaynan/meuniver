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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = createClient();

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
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
      setBusy(false);
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
        {mode === "login" ? "Entre com seu e-mail e senha para acessar seus convites." : "Crie sua conta gratuitamente com e-mail e senha."}
      </p>

      <div className="mt-5 rounded-2xl border border-[#eaded7] bg-[#fffaf7] px-4 py-3 text-sm leading-5 text-[#725f63]">
        Nesta fase de testes, o acesso por Google, Facebook, telefone e outros provedores externos está desativado. Eles poderão ser habilitados depois sem alterar seus convites.
      </div>

      <form onSubmit={submitEmail} className="mt-6 space-y-4">
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
        <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7d1f37] font-bold text-white transition hover:bg-[#64172b] disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {mode === "login" ? "Entrar no painel" : "Criar minha conta"}
        </button>
      </form>

      {message && <p className="mt-4 rounded-xl bg-[#fff5ed] px-4 py-3 text-sm leading-5 text-[#77543c]">{message}</p>}
    </div>
  );
}
