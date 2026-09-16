import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteAdminUser } from "@/lib/site-admin";
import { AdminUsersManager, type AdminUserRow } from "@/components/admin-users-manager";

export default async function AdminUsersPage() {
  const currentAdmin = await getSiteAdminUser();
  if (!currentAdmin) return null;

  const admin = createAdminSupabaseClient();
  const [{ data: authData }, { data: profiles }, { data: invitations }, { data: admins }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id,full_name,email,whatsapp,state,city,created_at"),
    admin.from("invitations").select("id,owner_id"),
    admin.from("site_admins").select("user_id"),
  ]);

  const profileMap = new Map((profiles ?? []).map((item) => [item.id, item]));
  const adminIds = new Set((admins ?? []).map((item) => item.user_id));
  const invitationCounts = new Map<string, number>();
  for (const invitation of invitations ?? []) invitationCounts.set(invitation.owner_id, (invitationCounts.get(invitation.owner_id) ?? 0) + 1);

  const users: AdminUserRow[] = (authData?.users ?? []).map((user) => {
    const profile = profileMap.get(user.id);
    return {
      id: user.id,
      full_name: profile?.full_name || String(user.user_metadata?.full_name ?? ""),
      email: profile?.email || user.email || "",
      whatsapp: profile?.whatsapp || "",
      state: profile?.state || "",
      city: profile?.city || "",
      created_at: profile?.created_at || user.created_at,
      invitations: invitationCounts.get(user.id) ?? 0,
      is_admin: adminIds.has(user.id),
    };
  }).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7438]">Administração</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Usuários</h1>
        <p className="mt-2 text-[#806e72]">Crie contas, altere dados de acesso e cadastro ou exclua usuários do sistema.</p>
      </div>
      <AdminUsersManager users={users} currentAdminId={currentAdmin.id} />
    </div>
  );
}
