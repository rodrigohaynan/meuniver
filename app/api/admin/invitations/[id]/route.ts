import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteAdminUser } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const adminUser = await getSiteAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Convite inválido." }, { status: 400 });

  const payload = await request.json().catch(() => null);
  if (payload?.confirmation !== "EXCLUIR") {
    return NextResponse.json({ error: "Confirme a exclusão do convite." }, { status: 400 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const { data: invitation, error: findError } = await admin
      .from("invitations")
      .select("id,owner_id,event_title,slug,status")
      .eq("id", id)
      .maybeSingle();

    if (findError) throw findError;
    if (!invitation) return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });

    // Exclusão é exclusiva do administrador autenticado neste endpoint.
    // Os dados vinculados por FK são excluídos pelo ON DELETE CASCADE no banco.
    const { data: deleted, error: deleteError } = await admin
      .from("invitations")
      .delete()
      .eq("id", invitation.id)
      .select("id")
      .maybeSingle();

    if (deleteError) throw deleteError;
    if (!deleted) return NextResponse.json({ error: "Convite não encontrado ou já excluído." }, { status: 404 });

    const { error: auditError } = await admin.from("admin_audit_log").insert({
      admin_user_id: adminUser.id,
      action: "invitation.delete",
      entity_type: "invitation",
      entity_id: invitation.id,
      details: {
        owner_id: invitation.owner_id,
        event_title: invitation.event_title,
        slug: invitation.slug,
        status: invitation.status,
      },
    });
    if (auditError) console.error("Falha ao registrar auditoria da exclusão:", auditError.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao excluir convite no painel administrativo:", error);
    return NextResponse.json({ error: "Não foi possível excluir o convite. Tente novamente." }, { status: 500 });
  }
}
