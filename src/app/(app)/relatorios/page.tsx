import { getActiveCampaign, getCurrentProfile } from "@/lib/session";
import TopBar from "@/components/TopBar";
import NoPermission from "@/components/NoPermission";
import ExportCsvButton from "@/components/admin/ExportCsvButton";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return (
      <>
        <TopBar title="Relatórios" />
        <NoPermission />
      </>
    );
  }

  const campaign = await getActiveCampaign();
  if (!campaign) {
    return (
      <>
        <TopBar title="Relatórios" />
        <div className="p-6 text-center text-verde-oliva">Nenhuma campanha ativa.</div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Relatórios" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
          <h3 className="mb-2 font-semibold text-verde-profundo">Exportar vendas</h3>
          <p className="mb-3 text-sm text-verde-oliva">
            Gera um CSV com todos os pedidos (reservados, pendentes e pagos) desta campanha: números,
            comprador, cooperador, status, valor e data.
          </p>
          <ExportCsvButton campaignId={campaign.id} />
        </div>
        <p className="text-xs text-verde-oliva/70">
          Consulte também Ranking (vendas por cooperador) e Tesouraria (pendências e arrecadação).
          Exportação em PDF está prevista para uma próxima versão.
        </p>
      </main>
    </>
  );
}
