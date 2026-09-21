"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";
import { formatDateTime } from "@/lib/format";

interface BugReport {
  id: string;
  screen: string | null;
  message: string;
  created_at: string;
  reporter: { full_name: string } | null;
}

interface SystemError {
  id: string;
  source: string;
  message: string;
  created_at: string;
  actor: { full_name: string } | null;
}

export function BugReportList({ reports }: { reports: BugReport[] }) {
  const router = useRouter();

  async function resolve(id: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc("resolve_bug_report", { p_id: id });
    if (error) throw error;
    router.refresh();
  }

  if (reports.length === 0) {
    return <p className="py-6 text-center text-sm text-verde-oliva">Nenhum problema reportado em aberto. 🎉</p>;
  }

  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <div key={r.id} className="rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-verde-oliva/10">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-verde-profundo">{r.message}</p>
              <p className="mt-1 text-xs text-verde-oliva">
                {r.reporter?.full_name ?? "Usuário"} · {r.screen ?? "tela desconhecida"} ·{" "}
                {formatDateTime(r.created_at)}
              </p>
            </div>
            <div className="w-32 shrink-0">
              <ActionButton
                label="Resolver"
                labelDoing="..."
                labelDone="✓"
                variant="secondary"
                onAction={() => resolve(r.id)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SystemErrorList({ errors }: { errors: SystemError[] }) {
  const router = useRouter();

  async function resolve(id: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc("resolve_system_error", { p_id: id });
    if (error) throw error;
    router.refresh();
  }

  if (errors.length === 0) {
    return <p className="py-6 text-center text-sm text-verde-oliva">Nenhum erro inesperado registrado. 🎉</p>;
  }

  return (
    <div className="space-y-2">
      {errors.map((e) => (
        <div key={e.id} className="rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-terracota/20">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-xs text-terracota">{e.source}</p>
              <p className="mt-1 break-words text-verde-profundo">{e.message}</p>
              <p className="mt-1 text-xs text-verde-oliva">
                {e.actor?.full_name ?? "Sistema"} · {formatDateTime(e.created_at)}
              </p>
            </div>
            <div className="w-32 shrink-0">
              <ActionButton
                label="Resolver"
                labelDoing="..."
                labelDone="✓"
                variant="secondary"
                onAction={() => resolve(e.id)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
