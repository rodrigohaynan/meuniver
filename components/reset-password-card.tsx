"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordCard() {
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (password.length < 6) {
      setMessage("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("As senhas não conferem.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setMessage("Este link de recuperação expirou ou não é mais válido. Solicite um novo link.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      setMessage("Senha alterada com sucesso. Você já pode acessar sua conta com a nova senha.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full rounded-[1.8rem] border border-[#dfd0c6] bg-white/95 p-5 shadow-[0_22px_65px_rgba(75,35,47,.11)] sm:p-6 xl:p-7">
      <h1 className="font-display text-2xl font-bold leading-[1.08] text-[#351820] sm:text-[28px]">
        Criar nova senha
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#7c686d]">
        Escolha uma nova senha para acessar sua conta na Convidata.
      </p>

      {!success ? (
        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block min-w-0">
            <span className="text-[13px] font-bold text-[#594147]">Nova senha</span>
            <div className="mt-1.5 flex min-h-11 items-center gap-2 rounded-xl border border-[#d9cbc3] bg-white px-3 focus-within:border-[#a96b7b] focus-within:ring-2 focus-within:ring-[#a96b7b]/15">
              <LockKeyhole className="size-4 shrink-0 text-[#9b858b]" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
                className="min-w-0 flex-1 bg-transparent outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="grid size-8 place-items-center rounded-full text-[#806e72] hover:bg-[#f5ece7]"
                aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>

          <label className="block min-w-0">
            <span className="text-[13px] font-bold text-[#594147]">Confirmar nova senha</span>
            <div className="mt-1.5 flex min-h-11 items-center gap-2 rounded-xl border border-[#d9cbc3] bg-white px-3 focus-within:border-[#a96b7b] focus-within:ring-2 focus-within:ring-[#a96b7b]/15">
              <LockKeyhole className="size-4 shrink-0 text-[#9b858b]" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
                className="min-w-0 flex-1 bg-transparent outline-none"
                placeholder="Repita a nova senha"
              />
            </div>
          </label>

          <button
            disabled={busy}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7d1f37] font-bold text-white transition hover:bg-[#64172b] disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Salvar nova senha
          </button>
        </form>
      ) : (
        <a
          href="/entrar"
          className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-[#7d1f37] font-bold text-white"
        >
          Ir para entrar
        </a>
      )}

      {message && (
        <p className="mt-3 rounded-xl bg-[#fff5ed] px-4 py-3 text-sm leading-5 text-[#77543c]">
          {message}
        </p>
      )}
    </div>
  );
}
