import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteAdminUser } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const adminUser = await getSiteAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({}));
    const invitationChargingEnabled = Boolean(body.invitationChargingEnabled);
    const invitationPrice = Number(body.invitationPrice ?? 0);
    const freeInvitesPerUser = Math.max(0, Math.round(Number(body.freeInvitesPerUser ?? 0)));
    const pixPlatformFeePercent = Number(body.pixPlatformFeePercent ?? 5);
    const reminderFeatureEnabled = Boolean(body.reminderFeatureEnabled);

    if (!Number.isFinite(invitationPrice) || invitationPrice < 0 || invitationPrice > 100000) {
      return NextResponse.json({ error: "Valor por convite inválido." }, { status: 400 });
    }
    if (!Number.isFinite(pixPlatformFeePercent) || pixPlatformFeePercent < 0 || pixPlatformFeePercent > 100) {
      return NextResponse.json({ error: "Percentual da taxa PIX inválido." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("site_settings").upsert({
      id: true,
      invitation_charging_enabled: invitationChargingEnabled,
      invitation_price: invitationPrice,
      free_invites_per_user: freeInvitesPerUser,
      pix_platform_fee_percent: pixPlatformFeePercent,
      reminder_feature_enabled: reminderFeatureEnabled,
      updated_at: new Date().toISOString(),
      updated_by: adminUser.id,
    });
    if (error) throw new Error(error.message);

    await admin.from("admin_audit_log").insert({
      admin_user_id: adminUser.id,
      action: "settings.update",
      entity_type: "site_settings",
      entity_id: "global",
      details: {
        invitation_charging_enabled: invitationChargingEnabled,
        invitation_price: invitationPrice,
        free_invites_per_user: freeInvitesPerUser,
        pix_platform_fee_percent: pixPlatformFeePercent,
        reminder_feature_enabled: reminderFeatureEnabled,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao atualizar configurações." }, { status: 500 });
  }
}
