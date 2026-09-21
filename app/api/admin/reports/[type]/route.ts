import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteAdminUser } from "@/lib/site-admin";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

function csv(rows: unknown[][]) {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}

function responseCsv(filename: string, rows: unknown[][]) {
  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ type: string }> }) {
  const adminUser = await getSiteAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const { type } = await context.params;
  const admin = createAdminSupabaseClient();
  const date = new Date().toISOString().slice(0, 10);

  if (type === "usuarios") {
    const [{ data: profiles }, { data: invitations }] = await Promise.all([
      admin.from("profiles").select("id,full_name,email,whatsapp,state,city,created_at").order("created_at"),
      admin.from("invitations").select("owner_id"),
    ]);
    const counts = new Map<string, number>();
    for (const item of invitations ?? []) counts.set(item.owner_id, (counts.get(item.owner_id) ?? 0) + 1);
    return responseCsv(`convidata-usuarios-${date}.csv`, [
      ["Nome", "E-mail", "WhatsApp", "UF", "Cidade", "Convites", "Cadastrado em"],
      ...(profiles ?? []).map((item) => [item.full_name, item.email, item.whatsapp, item.state, item.city, counts.get(item.id) ?? 0, item.created_at]),
    ]);
  }

  if (type === "convites") {
    const [{ data: invitations }, { data: profiles }] = await Promise.all([
      admin.from("invitations").select("id,owner_id,event_title,host_name,status,event_date,billing_status,billing_amount,created_at").order("created_at"),
      admin.from("profiles").select("id,email"),
    ]);
    const emails = new Map((profiles ?? []).map((item) => [item.id, item.email]));
    return responseCsv(`convidata-convites-${date}.csv`, [
      ["Convite", "Pessoa homenageada", "Proprietário", "Status", "Data do evento", "Cobrança", "Valor", "Criado em"],
      ...(invitations ?? []).map((item) => [item.event_title, item.host_name, emails.get(item.owner_id) ?? "", item.status, item.event_date ?? "", item.billing_status, item.billing_amount, item.created_at]),
    ]);
  }

  if (type === "rsvps") {
    const [{ data: rsvps }, { data: invitations }] = await Promise.all([
      admin.from("rsvps").select("invitation_id,contact_name,whatsapp,attendees,created_at").order("created_at"),
      admin.from("invitations").select("id,event_title"),
    ]);
    const titles = new Map((invitations ?? []).map((item) => [item.id, item.event_title]));
    const rows: unknown[][] = [["Convite", "Responsável", "WhatsApp", "Convidado", "Categoria", "Confirmado em"]];
    for (const item of rsvps ?? []) {
      const attendees = Array.isArray(item.attendees) ? item.attendees : [];
      for (const attendee of attendees as Array<{ name?: string; category?: string }>) {
        rows.push([titles.get(item.invitation_id) ?? "", item.contact_name, item.whatsapp, attendee.name ?? "", attendee.category === "child" ? "Criança" : "Adulto", item.created_at]);
      }
    }
    return responseCsv(`convidata-presencas-${date}.csv`, rows);
  }

  if (type === "financeiro") {
    const [{ data: gifts }, { data: invitations }, { data: profiles }] = await Promise.all([
      admin.from("cash_gifts").select("owner_id,invitation_id,guest_name,guest_email,amount,platform_fee,payment_status,payment_id,created_at").order("created_at"),
      admin.from("invitations").select("id,event_title,billing_status,billing_amount,owner_id,created_at").order("created_at"),
      admin.from("profiles").select("id,email"),
    ]);
    const emails = new Map((profiles ?? []).map((item) => [item.id, item.email]));
    const titles = new Map((invitations ?? []).map((item) => [item.id, item.event_title]));
    const rows: unknown[][] = [["Tipo", "Convite", "Proprietário", "Pagador/Convidado", "E-mail", "Valor", "Taxa Convidata", "Status", "ID pagamento", "Data"]];
    for (const item of gifts ?? []) rows.push(["Presente PIX", titles.get(item.invitation_id) ?? "", emails.get(item.owner_id) ?? "", item.guest_name, item.guest_email, item.amount, item.platform_fee, item.payment_status, item.payment_id ?? "", item.created_at]);
    for (const item of invitations ?? []) rows.push(["Cobrança convite", item.event_title, emails.get(item.owner_id) ?? "", "", "", item.billing_amount, "", item.billing_status, "", item.created_at]);
    return responseCsv(`convidata-financeiro-${date}.csv`, rows);
  }

  return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });
}
