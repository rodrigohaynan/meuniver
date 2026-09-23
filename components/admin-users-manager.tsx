"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Plus, Save, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

export type AdminUserRow = {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  state: string;
  city: string;
  created_at: string;
  invitations: number;
  is_admin?: boolean;
};

export function AdminUsersManager({ users, currentAdminId }: { users: AdminUserRow[]; currentAdminId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("create"); setMessage("");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return setMessage(data.error || "Não foi possível criar o usuário.");
    setMessage("Usuário criado com sucesso.");
    event.currentTarget.reset();
    router.refresh();
  }

  async function saveUser(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(id); setMessage("");
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return setMessage(data.error || "Não foi possível atualizar o usuário.");
    setMessage("Dados atualizados.");
    router.refresh();
  }

  async function deleteUser(user: AdminUserRow) {
    if (user.id === currentAdminId) return;
    if (!window.confirm(`Excluir a conta de ${user.full_name || user.email}? Convites e dados vinculados poderão ser removidos em cascata.`)) return;
    setBusy(user.id); setMessage("");
    const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return setMessage(data.error || "Não foi possível excluir o usuário.");
    setMessage("Usuário excluído.");
    router.refresh();
  }

  return (
    <div>
      <details className="rounded-[1.5rem] border border-[#e3d6cf] bg-white p-5 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-display text-xl font-bold"><Plus className="size-5 text-[#7d1f37]" /> Criar usuário</summary>
        <form onSubmit={createUser} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome completo"><input name="fullName" required className="input-admin" /></Field>
          <Field label="E-mail"><input name="email" type="email" required className="input-admin" /></Field>
          <Field label="Senha inicial"><input name="password" type="password" minLength={8} required className="input-admin" /></Field>
          <Field label="WhatsApp"><input name="whatsapp" className="input-admin" /></Field>
          <Field label="UF"><input name="state" maxLength={2} className="input-admin" /></Field>
          <Field label="Cidade"><input name="city" className="input-admin" /></Field>
          <div className="sm:col-span-2 lg:col-span-3"><button disabled={busy === "create"} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#7d1f37] px-5 font-bold text-white disabled:opacity-50">{busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Criar conta</button></div>
        </form>
      </details>

      {message && <p className="mt-4 rounded-xl bg-[#f5ece7] px-4 py-3 text-sm font-bold text-[#684f55]">{message}</p>}

      <div className="mt-5 space-y-3">
        {users.map((user) => (
          <article key={user.id} className="overflow-hidden rounded-[1.5rem] border border-[#e3d6cf] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f5ece7] text-[#7d1f37]"><UserRound className="size-4" /></span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-[#351820]">{user.full_name || "Sem nome"}</p>
                  <p className="truncate text-sm text-[#806e72]">{user.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <Link
                  href={`/admin/convites?usuario=${encodeURIComponent(user.id)}`}
                  aria-label={`Ver ${user.invitations} convites de ${user.full_name || user.email || "este usuário"}`}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#e4cfcd] bg-[#f4ece6] px-4 text-[#7d1f37] transition hover:border-[#7d1f37] hover:bg-[#fcefee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7d1f37]"
                >
                  {user.invitations} convite(s) <span aria-hidden="true">→</span>
                </Link>
                {user.is_admin && <span className="rounded-full bg-[#7d1f37] px-3 py-2 text-white">Admin</span>}
              </div>
            </div>
            <details className="border-t border-[#eee4de]">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-bold text-[#684f55] hover:bg-[#faf6f3] sm:px-6">
                Gerenciar cadastro <ChevronDown className="size-4" />
              </summary>
              <form onSubmit={(event) => saveUser(event, user.id)} className="border-t border-[#eee4de] p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Nome completo"><input name="fullName" defaultValue={user.full_name} required className="input-admin" /></Field>
                  <Field label="E-mail"><input name="email" type="email" defaultValue={user.email} required className="input-admin" /></Field>
                  <Field label="Nova senha (opcional)"><input name="password" type="password" minLength={8} placeholder="Deixe em branco para manter" className="input-admin" /></Field>
                  <Field label="WhatsApp"><input name="whatsapp" defaultValue={user.whatsapp} className="input-admin" /></Field>
                  <Field label="UF"><input name="state" defaultValue={user.state} maxLength={2} className="input-admin" /></Field>
                  <Field label="Cidade"><input name="city" defaultValue={user.city} className="input-admin" /></Field>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button disabled={busy === user.id} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#7d1f37] px-4 text-sm font-bold text-white disabled:opacity-50">{busy === user.id ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar alterações</button>
                  {user.id !== currentAdminId && <button type="button" onClick={() => void deleteUser(user)} disabled={busy === user.id} className="inline-flex h-10 items-center gap-2 rounded-full border border-red-200 px-4 text-sm font-bold text-red-700"><Trash2 className="size-4" /> Excluir usuário</button>}
                </div>
              </form>
            </details>
          </article>
        ))}
        {users.length === 0 && <p className="rounded-[1.5rem] border border-dashed border-[#e3d6cf] bg-white px-5 py-8 text-center text-sm text-[#806e72]">Nenhuma conta encontrada. Ajuste a busca ou limpe os filtros.</p>}
      </div>

      <style jsx global>{`.input-admin{height:44px;width:100%;border:1px solid #d8c7bd;border-radius:12px;padding:0 12px;background:#fff;outline:none}.input-admin:focus{border-color:#9e6172;box-shadow:0 0 0 2px rgba(158,97,114,.12)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-bold text-[#594147]">{label}<div className="mt-2">{children}</div></label>;
}
