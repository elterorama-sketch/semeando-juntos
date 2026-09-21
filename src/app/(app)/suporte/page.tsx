import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/session";
import TopBar from "@/components/TopBar";
import NoPermission from "@/components/NoPermission";
import { BugReportList, SystemErrorList } from "@/components/admin/SupportLists";

export const dynamic = "force-dynamic";

export default async function SuportePage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return (
      <>
        <TopBar title="Suporte" />
        <NoPermission />
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: bugReports }, { data: systemErrors }] = await Promise.all([
    supabase
      .from("bug_reports")
      .select("id, screen, message, created_at, reporter:profiles(full_name)")
      .eq("status", "aberto")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("system_error_reports")
      .select("id, source, message, created_at, actor:profiles(full_name)")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <>
      <TopBar title="Suporte" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-verde-oliva">
            Erros inesperados do sistema ({(systemErrors ?? []).length})
          </h2>
          <p className="mb-3 text-xs text-verde-oliva/80">
            Capturados automaticamente quando um fluxo crítico (reservar, vender, confirmar
            pagamento, liberar número) falha de um jeito que não é uma regra de negócio conhecida.
          </p>
          <SystemErrorList
            errors={
              (systemErrors ?? []) as unknown as Parameters<typeof SystemErrorList>[0]["errors"]
            }
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-verde-oliva">
            Problemas reportados por usuários ({(bugReports ?? []).length})
          </h2>
          <BugReportList
            reports={
              (bugReports ?? []) as unknown as Parameters<typeof BugReportList>[0]["reports"]
            }
          />
        </section>
      </main>
    </>
  );
}
