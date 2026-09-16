import { CalendarDays, CircleDollarSign, Download, UsersRound } from "lucide-react";

const reports = [
  { key: "usuarios", title: "Usuários", description: "Cadastro, contato, cidade e quantidade de convites por conta.", icon: UsersRound },
  { key: "convites", title: "Convites", description: "Status de publicação, data, proprietário e situação de cobrança.", icon: CalendarDays },
  { key: "rsvps", title: "Presenças", description: "Responsáveis, WhatsApp, convidados e categoria adulto/criança.", icon: UsersRound },
  { key: "financeiro", title: "Financeiro", description: "Presentes em PIX, taxas da plataforma e cobrança dos convites.", icon: CircleDollarSign },
];

export default function AdminReportsPage() {
  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7438]">Administração</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Relatórios</h1>
        <p className="mt-2 text-[#806e72]">Exporte dados operacionais em CSV, compatível com Excel e Google Planilhas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map(({ key, title, description, icon: Icon }) => (
          <article key={key} className="rounded-[1.6rem] border border-[#e3d6cf] bg-white p-5 shadow-sm sm:p-6">
            <span className="grid size-11 place-items-center rounded-full bg-[#f5ece7] text-[#7d1f37]"><Icon className="size-5" /></span>
            <h2 className="mt-4 font-display text-2xl font-bold">{title}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-[#806e72]">{description}</p>
            <a href={`/api/admin/reports/${key}`} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#7d1f37] px-4 text-sm font-bold text-white"><Download className="size-4" /> Baixar CSV</a>
          </article>
        ))}
      </div>
    </div>
  );
}
