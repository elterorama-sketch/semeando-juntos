import type { NumberStatus } from "@/lib/database.types";

const STATUS_CONFIG: Record<NumberStatus, { label: string; icon: string; classes: string }> = {
  DISPONIVEL: { label: "Disponível", icon: "○", classes: "bg-creme text-verde-profundo" },
  RESERVADO: { label: "Reservado", icon: "◐", classes: "bg-amber-100 text-amber-900" },
  AGUARDANDO_PAGAMENTO: {
    label: "Aguardando pagamento",
    icon: "◑",
    classes: "bg-orange-100 text-orange-900",
  },
  PAGO: { label: "Pago", icon: "●", classes: "bg-verde-oliva/20 text-verde-profundo" },
  CANCELADO: { label: "Cancelado", icon: "✕", classes: "bg-neutral-200 text-neutral-500" },
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
