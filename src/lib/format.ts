export function formatCentsBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatNumber(n: number, digits = 3): string {
  return n.toString().padStart(digits, "0");
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  // Pages that render this run as React Server Components on Vercel, whose
  // runtime clock is UTC -- without an explicit timeZone here,
  // toLocaleString() converts to the *server's* zone, not the visitor's,
  // showing a time hours ahead of Brasília. The app is Brazil-only, so
  // hardcoding it is correct in every render context (server or browser).
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  // Date-only strings ("2026-11-15") parse as UTC midnight; formatting them
  // in a UTC-negative timezone (e.g. Brazil) would otherwise roll back a
  // day. Parse the parts directly instead of going through Date/UTC.
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "-";
  return `${day}/${month}/${year}`;
}
