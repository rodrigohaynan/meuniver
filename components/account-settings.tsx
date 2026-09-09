"use client";

import {
  CalendarDays,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type IbgeCity = {
  id: number;
  nome: string;
};

export type AccountProfile = {
  id: string;
  full_name: string;
  sex: string;
  birth_date: string;
  state: string;
  city: string;
  whatsapp: string;
  email: string;
  created_at: string;
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

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não disponível";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function AccountSettings({ initialProfile }: { initialProfile: AccountProfile }) {
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState(initialProfile.full_name);
  const [sex, setSex] = useState(initialProfile.sex);
  const [birthDate, setBirthDate] = useState(initialProfile.birth_date);
  const [stateUf, setStateUf] = useState(initialProfile.state);
  const [city, setCity] = useState(initialProfile.city);
  const [whatsapp, setWhatsapp] = useState(formatWhatsapp(initialProfile.whatsapp));
  const [email, setEmail] = useState(initialProfile.email);
  const [savedEmail, setSavedEmail] = useState(initialProfile.email);
  const [cities, setCities] = useState<IbgeCity[]>([]);
  const [citiesBusy, setCitiesBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    if (!stateUf) {
      setCities([]);
      return;
    }

    let active = true;
    const controller = new AbortController();

    async function loadCities() {
      setCitiesBusy(true);
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
          setProfileMessage("Não foi possível carregar as cidades. Selecione o estado novamente.");
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

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profileBusy) return;

    const cleanName = fullName.trim().replace(/\s+/g, " ");
    const cleanEmail = email.trim().toLowerCase();
    const cleanWhatsapp = digits(whatsapp);

    if (cleanName.length < 3) {
      setProfileMessage("Informe seu nome completo.");
      return;
    }
    if (!sex || !birthDate || !stateUf || !city || cleanWhatsapp.length < 10) {
      setProfileMessage("Preencha sexo, data de nascimento, estado, cidade e WhatsApp.");
      return;
    }
    if (!cleanEmail.includes("@")) {
      setProfileMessage("Informe um e-mail válido.");
      return;
    }

    setProfileBusy(true);
    setProfileMessage("");

    try {
      const metadata = {
        full_name: cleanName,
        sex,
        birth_date: birthDate,
        state: stateUf,
        city,
        whatsapp: cleanWhatsapp,
      };

      const emailChanged = cleanEmail !== savedEmail.trim().toLowerCase();
      const { error: authError } = await supabase.auth.updateUser(
        emailChanged
          ? { email: cleanEmail, data: metadata }
          : { data: metadata },
      );
      if (authError) throw authError;

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: initialProfile.id,
        full_name: cleanName,
        sex,
        birth_date: birthDate,
        state: stateUf,
        city,
        whatsapp: cleanWhatsapp,
        email: cleanEmail,
      });
      if (profileError) throw profileError;

      setFullName(cleanName);
      setWhatsapp(formatWhatsapp(cleanWhatsapp));
      setSavedEmail(cleanEmail);
      setProfileMessage(
        emailChanged
          ? "Dados salvos. Se a confirmação de troca de e-mail estiver ativa, confirme a alteração pelo e-mail recebido."
          : "Seus dados foram atualizados.",
      );
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Não foi possível atualizar seus dados.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordBusy) return;

    if (newPassword.length < 6) {
      setPasswordMessage("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("As senhas não conferem.");
      return;
    }

    setPasswordBusy(true);
    setPasswordMessage("");

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Senha alterada com sucesso.");
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : "Não foi possível alterar a senha.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)] lg:items-start">
      <section className="rounded-[1.8rem] border border-[#e4d8d0] bg-[#fffdfa] p-5 shadow-[0_12px_40px_rgba(83,48,58,.045)] sm:p-7">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#f5ece7] text-[#7d1f37]">
            <UserRound className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-bold text-[#351820]">Meus dados</h2>
            <p className="mt-1 text-sm leading-6 text-[#806e72]">
              Estas informações ficam vinculadas à sua conta de organizador.
            </p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="mt-6 space-y-4">
          <Field label="Nome completo" icon={<UserRound className="size-4" />}>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" className="min-w-0 flex-1 bg-transparent outline-none" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sexo" icon={<UsersRound className="size-4" />}>
              <select value={sex} onChange={(event) => setSex(event.target.value)} required className="min-w-0 flex-1 bg-transparent outline-none">
                <option value="">Selecione</option>
                <option value="female">Feminino</option>
                <option value="male">Masculino</option>
                <option value="other">Outro</option>
                <option value="prefer_not_to_say">Prefiro não informar</option>
              </select>
            </Field>

            <Field label="Data de nascimento" icon={<CalendarDays className="size-4" />}>
              <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required autoComplete="bday" className="min-w-0 flex-1 bg-transparent outline-none" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estado" icon={<MapPin className="size-4" />}>
              <select
                value={stateUf}
                onChange={(event) => {
                  setStateUf(event.target.value);
                  setCity("");
                }}
                required
                className="min-w-0 flex-1 bg-transparent outline-none"
              >
                <option value="">Selecione</option>
                {BRAZIL_STATES.map(([uf, name]) => <option key={uf} value={uf}>{name}</option>)}
              </select>
            </Field>

            <Field label="Cidade" icon={<MapPin className="size-4" />}>
              <select value={city} onChange={(event) => setCity(event.target.value)} required disabled={!stateUf || citiesBusy} className="min-w-0 flex-1 bg-transparent outline-none disabled:opacity-50">
                {city && !cities.some((item) => item.nome === city) && <option value={city}>{city}</option>}
                <option value="">{citiesBusy ? "Carregando…" : "Selecione"}</option>
                {cities.map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Celular / WhatsApp" icon={<Phone className="size-4" />}>
              <input type="tel" value={whatsapp} onChange={(event) => setWhatsapp(formatWhatsapp(event.target.value))} required autoComplete="tel" inputMode="tel" className="min-w-0 flex-1 bg-transparent outline-none" />
            </Field>

            <Field label="E-mail de acesso" icon={<Mail className="size-4" />}>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="min-w-0 flex-1 bg-transparent outline-none" />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button disabled={profileBusy} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white disabled:opacity-60">
              {profileBusy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar meus dados
            </button>
            {profileMessage && <p className="text-sm font-semibold text-[#765f65]">{profileMessage}</p>}
          </div>
        </form>
      </section>

      <div className="space-y-6">
        <section className="rounded-[1.8rem] border border-[#e4d8d0] bg-[#fffdfa] p-5 shadow-[0_12px_40px_rgba(83,48,58,.045)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f5ece7] text-[#7d1f37]">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-[#351820]">Segurança</h2>
              <p className="mt-1 text-sm text-[#806e72]">Altere sua senha de acesso.</p>
            </div>
          </div>

          <form onSubmit={changePassword} className="mt-5 space-y-4">
            <Field label="Nova senha" icon={<LockKeyhole className="size-4" />} trailing={
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="grid size-8 shrink-0 place-items-center rounded-full text-[#806e72] hover:bg-[#f5ece7]" aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}>
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }>
              <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={6} autoComplete="new-password" className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Mínimo de 6 caracteres" />
            </Field>

            <Field label="Confirmar nova senha" icon={<LockKeyhole className="size-4" />}>
              <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} autoComplete="new-password" className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Repita a nova senha" />
            </Field>

            <button disabled={passwordBusy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#7d1f37] bg-white px-5 font-bold text-[#7d1f37] disabled:opacity-60">
              {passwordBusy && <Loader2 className="size-4 animate-spin" />}
              Alterar senha
            </button>

            {passwordMessage && <p className="text-sm font-semibold text-[#765f65]">{passwordMessage}</p>}
          </form>
        </section>

        <section className="rounded-[1.8rem] border border-[#e4d8d0] bg-white p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[#9a7e85]">Informações da conta</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-[#eee4de] pb-3">
              <span className="text-[#806e72]">Conta criada em</span>
              <strong className="text-right text-[#4e343a]">{formatCreatedAt(initialProfile.created_at)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#806e72]">Situação</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Conta ativa</span>
            </div>
          </div>
        </section>
      </div>
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
