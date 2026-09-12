"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";
import type { CampaignPrize } from "@/lib/database.types";

export default function PrizesEditor({
  campaignId,
  prizes,
}: {
  campaignId: string;
  prizes: CampaignPrize[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    if (!title.trim()) {
      setError("Informe o nome do prêmio.");
      throw new Error("validation");
    }
    const supabase = createClient();
    const nextPosition = prizes.length > 0 ? Math.max(...prizes.map((p) => p.position)) + 1 : 1;
    const { error: insertError } = await supabase.from("campaign_prizes").insert({
      campaign_id: campaignId,
      position: nextPosition,
      title: title.trim(),
      description: description.trim() || null,
    });
    if (insertError) {
      setError("Erro ao adicionar prêmio.");
      throw insertError;
    }
    setTitle("");
    setDescription("");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
      <h3 className="font-semibold text-verde-profundo">Prêmios</h3>
      <div className="space-y-2">
        {prizes.map((p) => (
          <div key={p.id} className="rounded-lg bg-creme p-3">
            <p className="font-semibold text-verde-profundo">
              {p.position}º prêmio — {p.title}
            </p>
            {p.description && <p className="text-sm text-verde-oliva">{p.description}</p>}
          </div>
        ))}
        {prizes.length === 0 && <p className="text-sm text-verde-oliva">Nenhum prêmio cadastrado.</p>}
      </div>

      <div className="space-y-2 border-t border-verde-oliva/15 pt-3">
        <input
          placeholder="Nome do prêmio (ex: Voucher R$ 500,00 — Loja Moriah)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
        <input
          placeholder="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
        {error && <p className="text-sm font-medium text-terracota">{error}</p>}
        <ActionButton label="Adicionar prêmio" labelDoing="Adicionando..." labelDone="Adicionado ✓" onAction={handleAdd} />
      </div>
    </div>
  );
}
