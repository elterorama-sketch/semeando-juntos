"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";

// Floating button on every screen -- part of the "evitar erros" plan
// (prioridade 2): before this, a real bug (order_numbers travado, login
// do Marcos) only reached the admin via a WhatsApp voice message relayed
// by someone else, hours or days late and with no technical detail. This
// gives every user a direct, always-visible way to report a problem, and
// automatically attaches which screen they were on.
export default function ReportBugButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setError(null);
    if (!message.trim()) {
      setError("Descreva o problema.");
      throw new Error("validation");
    }
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("report_bug", {
      p_screen: pathname,
      p_message: message.trim(),
    });
    if (rpcError) {
      setError("Erro ao enviar. Tente novamente.");
      throw rpcError;
    }
    setSent(true);
    setMessage("");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSent(false);
        }}
        aria-label="Reportar problema"
        className="tap-target fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-terracota text-xl text-off-white shadow-lg md:bottom-6"
      >
        ⚠️
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-off-white p-5 md:rounded-2xl">
        <div className="mb-3 flex items-start justify-between">
          <h2 className="text-lg font-bold text-verde-profundo">Reportar problema</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="tap-target text-verde-oliva"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {sent ? (
          <div className="py-6 text-center">
            <p className="text-4xl">✅</p>
            <p className="mt-2 font-semibold text-verde-profundo">Problema enviado!</p>
            <p className="mt-1 text-sm text-verde-oliva">Obrigado por avisar. Vamos verificar.</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="tap-target mt-4 w-full rounded-xl bg-verde-profundo py-3 font-semibold text-off-white"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <p className="mb-2 text-sm text-verde-oliva">
              Descreva o que aconteceu. Isso vai direto para a administração, com a tela em que você
              está.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Ex: dá erro na hora de confirmar o pagamento em dinheiro..."
              className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 text-sm outline-none focus:border-verde-profundo"
            />
            {error && <p className="mt-2 text-xs font-medium text-terracota">{error}</p>}
            <div className="mt-3">
              <ActionButton
                label="Enviar"
                labelDoing="Enviando..."
                labelDone="Enviado ✓"
                onAction={handleSend}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
