"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";

export default function NewCampaignForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [priceReais, setPriceReais] = useState("20,00");
  const [numberCount, setNumberCount] = useState("200");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    const priceCents = Math.round(parseFloat(priceReais.replace(",", ".")) * 100);
    const count = parseInt(numberCount, 10);
    if (!name.trim() || Number.isNaN(priceCents) || priceCents <= 0 || Number.isNaN(count) || count <= 0) {
      setError("Verifique os dados da nova campanha.");
      throw new Error("validation");
    }

    const supabase = createClient();
    const { data: campaign, error: insertError } = await supabase
      .from("campaigns")
      .insert({ name: name.trim(), price_cents: priceCents, number_count: count, number_start: 1, status: "RASCUNHO" })
      .select()
      .single();

    if (insertError || !campaign) {
      setError("Erro ao criar campanha.");
      throw insertError ?? new Error("failed");
    }

    const { error: genError } = await supabase.rpc("generate_campaign_numbers", {
      p_campaign_id: campaign.id,
    });
    if (genError) {
      setError("Campanha criada, mas houve erro ao gerar os números.");
      throw genError;
    }

    setName("");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
      <h3 className="font-semibold text-verde-profundo">Nova campanha</h3>
      <input
        placeholder="Nome da campanha"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
      />
      <div className="flex gap-2">
        <input
          placeholder="Valor por número (R$)"
          value={priceReais}
          onChange={(e) => setPriceReais(e.target.value)}
          inputMode="decimal"
          className="tap-target w-1/2 rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
        <input
          placeholder="Quantidade de números"
          value={numberCount}
          onChange={(e) => setNumberCount(e.target.value)}
          inputMode="numeric"
          className="tap-target w-1/2 rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
      </div>
      {error && <p className="text-sm font-medium text-terracota">{error}</p>}
      <ActionButton
        label="Criar campanha"
        labelDoing="Criando..."
        labelDone="Criada ✓"
        onAction={handleCreate}
      />
    </div>
  );
}
