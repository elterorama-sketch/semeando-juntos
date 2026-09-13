import type { NumberStatus } from "@/lib/database.types";

// Solid, high-contrast fills (not pale tints) so the three states a seller
// actually needs to tell apart at a glance -- livre, reservado, pago -- read
// instantly across a whole grid of 200 numbers, not just on close inspection.
const STATUS_CONFIG: Record<NumberStatus, { label: string; icon: string; classes: string }> = {
  DISPONIVEL: {
    label: "Disponível",
    icon: "○",
    classes: "bg-white text-verde-profundo ring-1 ring-inset ring-verde-oliva/40",
  },
  RESERVADO: { label: "Reservado", icon: "◐", classes: "bg-amber-400 text-verde-profundo" },
  AGUARDANDO_PAGAMENTO: {
    label: "Aguardando pagamento",
    icon: "◑",
    classes: "bg-orange-500 text-white",
  },
  PAGO: { label: "Pago", icon: "●", classes: "bg-emerald-600 text-white" },
  CANCELADO: { label: "Cancelado", icon: "✕", classes: "bg-neutral-300 text-neutral-600" },
};

export function StatusBadge({ status }: { status: NumberStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      role="status"
      aria-label={config.label}
      title={config.label}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.classes}`}
    >
      <span aria-hidden>{config.icon}</span>
      {config.label}
    </span>
  );
}

export function statusConfig(status: NumberStatus) {
  return STATUS_CONFIG[status];
}
