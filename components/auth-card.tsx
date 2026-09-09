"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CalendarDays,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  UserRound,
  UsersRound,
} from "lucide-react";

const REMEMBERED_EMAIL_KEY = "convniver.remembered-email";

type IbgeCity = {
  id: number;
  nome: string;
};

const BRAZIL_STATES = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
  ["BA", "Bahia"], ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"],
  ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
] as const;

function digits(value: string) {
  return value.replace(/\D/g, "").slice(0, 13);
}

function formatWhatsapp(value: string) {
  const clean = digits(value);
  const national = clean.startsWith("55") && clean.length > 11 ? clean.slice(2) : clean;

  if (national.length <= 2) return national;
  if (national.length <= 7) return `(${national.slice(0, 2)}) ${national.slice(2)}`;
  if (national.length <= 10) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  }
  return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7, 11)}`;
}

export function AuthCard() {
  const searchParams = useSearchParams();
  const origin = searchParams.get("origem");
  const [mode, setMode] = useState<"login" | "signup">(
    searchParams.get("modo") === "cadastro" ? "signup" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [sex, setSex] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<IbgeCity[]>([]);
  const [citiesBusy, setCitiesBusy] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUser, setRememberUser] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    try {
      const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (rememberedEmail) {
        setEmail(rememberedEmail);
        setRememberUser(true);
      }
    } catch {
      // O navegador pode bloquear localStorage; o login continua normalmente.
    }
  }, []);

  useEffect(() => {
    if (!stateUf) {
      setCities([]);
      setCity("");
      return;
    }

    let active = true;
    const controller = new AbortController();

    async function loadCities() {
      setCitiesBusy(true);
      setCity("");
      try {
        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(stateUf)}/municipios?orderBy=nome`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Não foi possível carregar as cidades.");
        const data = (await response.json()) as IbgeCity[];
        if (active) setCities(Array.isArray(data) ? data : []);
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setCities([]);
          setMessage("Não foi possível carregar as cidades. Tente selecionar o estado novamente.");
        }
      } finally {
        if (active) setCitiesBusy(false);
      }
    }

    void loadCities();
    return () => {
      active = false;
      controller.abort();
    };
  }, [stateUf]);

  function persistRememberedEmail() {
    try {
      if (rememberUser) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    } catch {
      // Sem impacto no login.
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage("");

    if (mode === "signup") {
      if (fullName.trim().length < 3) {
        setMessage("Informe seu nome completo.");
        return;
      }
      if (!sex || !birthDate || !stateUf || !city || digits(whatsapp).length < 10) {
        setMessage("Preencha sexo, data de nascimento, estado, cidade e WhatsApp.");
        return;
      }
      if (password !== confirmPassword) {
        setMessage("As senhas não conferem.");
        return;
      }
    }

    setBusy(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim().replace(/\s+/g, " "),
              sex,
              birth_date: birthDate,
              state: stateUf,
              city,
              whatsapp: digits(whatsapp),
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/painel`,
          },
        });
        if (error) throw error;
        persistRememberedEmail();
        setMessage(
          "Conta criada. Se a confirmação de e-mail estiver ativa, verifique sua caixa de entrada para concluir o cadastro.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        persistRememberedEmail();
        window.location.href = "/painel";
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  const signupFromConfirmation = mode === "signup" && origin === "confirmacao";

  return (
    <div className="w-full max-w-xl rounded-[2rem] border border-[#dfd0c6] bg-white/95 p-6 shadow-[0_24px_70px_rgba(75,35,47,.12)] sm:p-8">
      <div className="grid grid-cols-2 rounded-full bg-[#f5ece7] p-1">
        <button
          type="button"
          onClick={() => { setMode("login"); setMessage(""); }}
          className={`h-10 rounded-full text-sm font-bold transition ${mode === "login" ? "bg-white text-[#6e2037] shadow-sm" : "text-[#806e72]"}`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => { setMode("signup"); setMessage(""); }}
          className={`h-10 rounded-full text-sm font-bold transition ${mode === "signup" ? "bg-white text-[#6e2037] shadow-sm" : "text-[#806e72]"}`}
        >
          Criar conta
        </button>
      </div>

      <h1 className="mt-7 font-display text-3xl font-bold text-[#351820]">
        {mode === "login"
          ? "Bem-vindo de volta"
          : signupFromConfirmation
            ? "Sua presença já está confirmada. Agora venha para o CONVNIVER."
            : "Crie sua conta no CONVNIVER"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#7c686d]">
        {mode === "login"
          ? "Entre com seu e-mail e senha para acessar seus convites."
          : signupFromConfirmation
            ? "Cadastre-se gratuitamente e tenha sua conta pronta para criar e gerenciar seus próprios convites."
            : "Cadastre seus dados para começar a organizar seus próprios convites."}
      </p>

      <form onSubmit={submitEmail} className="mt-6 space-y-4">
        {mode === "signup" && (
          <>
            <Field label="Nome completo" icon={<UserRound className="size-4" />}>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                autoComplete="name"
                className="min-w-0 flex-1 outline-none"
                placeholder="Nome e sobrenome"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sexo" icon={<UsersRound className="size-4" />}>
                <select
                  value={sex}
                  onChange={(event) => setSex(event.target.value)}
                  required
                  className="min-w-0 flex-1 bg-transparent outline-none"
                >
                  <option value="">Selecione</option>
                  <option value="female">Feminino</option>
                  <option value="male">Masculino</option>
                  <option value="other">Outro</option>
                  <option value="prefer_not_to_say">Prefiro não informar</option>
                </select>
              </Field>

              <Field label="Data de nascimento" icon={<CalendarDays className="size-4" />}>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  required
                  autoComplete="bday"
                  className="min-w-0 flex-1 outline-none"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Estado" icon={<MapPin className="size-4" />}>
                <select
                  value={stateUf}
                  onChange={(event) => setStateUf(event.target.value)}
                  required
                  className="min-w-0 flex-1 bg-transparent outline-none"
                >
                  <option value="">Selecione</option>
                  {BRAZIL_STATES.map(([uf, name]) => (
                    <option key={uf} value={uf}>{name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Cidade" icon={<MapPin className="size-4" />}>
                <select
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  required
                  disabled={!stateUf || citiesBusy}
                  className="min-w-0 flex-1 bg-transparent outline-none disabled:opacity-50"
                >
                  <option value="">{citiesBusy ? "Carregando…" : "Selecione"}</option>
                  {cities.map((item) => (
                    <option key={item.id} value={item.nome}>{item.nome}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Celular / WhatsApp" icon={<Phone className="size-4" />}>
              <input
                type="tel"
                value={whatsapp}
                onChange={(event) => setWhatsapp(formatWhatsapp(event.target.value))}
                required
                autoComplete="tel"
                inputMode="tel"
                className="min-w-0 flex-1 outline-none"
                placeholder="(67) 99999-9999"
              />
            </Field>
          </>
        )}

        <Field label="E-mail" icon={<Mail className="size-4" />}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            className="min-w-0 flex-1 outline-none"
            placeholder="voce@email.com"
          />
        </Field>

        <Field label="Senha" icon={<LockKeyhole className="size-4" />} trailing={
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="grid size-8 shrink-0 place-items-center rounded-full text-[#806e72] hover:bg-[#f5ece7]"
            aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="min-w-0 flex-1 outline-none"
            placeholder="••••••••"
          />
        </Field>

        {mode === "signup" && (
          <Field label="Confirmar senha" icon={<LockKeyhole className="size-4" />}>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="min-w-0 flex-1 outline-none"
              placeholder="Repita a senha"
            />
          </Field>
        )}

        {mode === "login" && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#684f55]">
            <input
              type="checkbox"
              checked={rememberUser}
              onChange={(event) => setRememberUser(event.target.checked)}
              className="size-4 accent-[#7d1f37]"
            />
            Lembrar usuário neste dispositivo
          </label>
        )}

        <button
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7d1f37] font-bold text-white transition hover:bg-[#64172b] disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {mode === "login" ? "Entrar no painel" : "Criar minha conta"}
        </button>
      </form>

      {message && (
        <p className="mt-4 rounded-xl bg-[#fff5ed] px-4 py-3 text-sm leading-5 text-[#77543c]">
          {message}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  icon,
  trailing,
  children,
}: {
  label: string;
  icon: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-[#594147]">{label}</span>
      <div className="mt-2 flex min-h-12 items-center gap-2 rounded-xl border border-[#d9cbc3] bg-white px-3 focus-within:border-[#a96b7b] focus-within:ring-2 focus-within:ring-[#a96b7b]/15">
        <span className="text-[#9b858b]">{icon}</span>
        {children}
        {trailing}
      </div>
    </label>
  );
}
