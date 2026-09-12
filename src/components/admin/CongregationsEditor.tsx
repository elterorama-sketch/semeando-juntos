"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";
import type { Congregation } from "@/lib/database.types";

export default function CongregationsEditor({ congregations }: { congregations: Congregation[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome da congregação.");
      throw new Error("validation");
    }
    const supabase = createClient();
    const { error: insertError } = await supabase.from("congregations").insert({ name: name.trim() });
    if (insertError) {
      setError(
        insertError.message.includes("duplicate") || insertError.message.includes("unique")
          ? "Já existe uma congregação com esse nome."
          : "Erro ao adicionar congregação."
      );
      throw insertError;
    }
    setName("");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
      <h3 className="font-semibold text-verde-profundo">Congregações</h3>
      <div className="space-y-2">
        {congregations.map((c) => (
          <div key={c.id} className="rounded-lg bg-creme p-3 font-medium text-verde-profundo">
            {c.name}
          </div>
        ))}
        {congregations.length === 0 && (
          <p className="text-sm text-verde-oliva">Nenhuma congregação cadastrada ainda.</p>
        )}
      </div>

      <div className="space-y-2 border-t border-verde-oliva/15 pt-3">
        <input
          placeholder="Nome da congregação (ex: Sede, Congregação Norte)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
        {error && <p className="text-sm font-medium text-terracota">{error}</p>}
        <ActionButton
          label="Adicionar congregação"
          labelDoing="Adicionando..."
          labelDone="Adicionada ✓"
          onAction={handleAdd}
        />
      </div>
    </div>
  );
}
