import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import TopBar from "@/components/TopBar";
import NoPermission from "@/components/NoPermission";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  RESERVAR_NUMEROS: "reservou os números",
  CONFIRMAR_PAGAMENTO: "confirmou o pagamento",
  LIBERAR_NUMEROS: "liberou os números",
  RESERVA_EXPIRADA: "reserva expirou automaticamente",
  REALIZAR_SORTEIO: "realizou o sorteio",
  GERAR_NUMEROS: "gerou os números da campanha",
};

export default async function AuditoriaPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return (
      <>
        <TopBar title="Auditoria" />
        <NoPermission />
      </>
    );
  }

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, new_value, old_value, created_at, actor:profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <TopBar title="Auditoria" />
      <main className="flex-1 space-y-2 p-4 md:p-6">
        {(logs ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-verde-oliva">Nenhum registro ainda.</p>
        )}
        {(logs ?? []).map((log) => {
          const actor = (log as unknown as { actor: { full_name: string } | null }).actor;
          return (
            <div key={log.id} className="rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-verde-oliva/10">
              <p className="text-verde-profundo">
                <span className="font-semibold">{actor?.full_name ?? "Sistema"}</span>{" "}
                {ACTION_LABELS[log.action] ?? log.action.toLowerCase()}
              </p>
              <p className="mt-1 text-xs text-verde-oliva">{formatDateTime(log.created_at)}</p>
            </div>
          );
        })}
      </main>
    </>
  );
}
