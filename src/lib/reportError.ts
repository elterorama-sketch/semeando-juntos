import type { SupabaseClient } from "@supabase/supabase-js";

// Every custom exception code the RPCs raise on purpose (see
// `grep -rhoE "raise exception '[A-Z_]+" supabase/migrations`) -- these are
// expected business-rule rejections (número já vendido, sem permissão,
// etc.), not bugs, and logging them would just bury real failures in
// noise. Anything that does NOT match one of these codes is unexpected --
// exactly the kind of error that left the order_numbers bug undetected for
// days -- and gets logged automatically to system_error_reports so it
// shows up in /suporte instead of only surfacing when a user complains.
const KNOWN_ERROR_CODES = [
  "CAMPANHA_INATIVA",
  "CAMPANHA_NAO_ENCONTRADA",
  "DESCRICAO_OBRIGATORIA",
  "NENHUM_NUMERO_SELECIONADO",
  "NOME_COMPRADOR_OBRIGATORIO",
  "NUMERO_INDISPONIVEL",
  "NUMERO_INEXISTENTE",
  "PAGAMENTO_DUPLICADO",
  "PEDIDO_CANCELADO",
  "PEDIDO_NAO_ENCONTRADO",
  "PERMISSAO_NEGADA",
  "PREMIO_JA_SORTEADO",
  "PREMIO_NAO_ENCONTRADO",
  "PROMOCAO_INCOMPLETA",
  "SEM_NUMEROS_ELEGIVEIS",
];

function isKnownErrorCode(message: string): boolean {
  return KNOWN_ERROR_CODES.some((code) => message.includes(code));
}

// Fire-and-forget: never blocks or throws into the caller's flow. A failure
// to log the error is not worth breaking the user-facing error message
// over -- it's swallowed silently on purpose.
export function reportUnexpectedRpcError(
  supabase: SupabaseClient,
  source: string,
  message: string,
  context?: Record<string, unknown>
) {
  if (isKnownErrorCode(message)) return;
  void supabase
    .rpc("report_client_error", {
      p_source: source,
      p_message: message,
      p_context: context ?? null,
    })
    .then(() => {});
}
