"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ActionButton from "@/components/ActionButton";
import type { UserRole } from "@/lib/database.types";

export default function InviteUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("seller");
  const [error, setError] = useState<string | null>(null);

  async function handleInvite() {
    setError(null);
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName, role }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao convidar usuário.");
      throw new Error(json.error);
    }
    setEmail("");
    setFullName("");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
      <h3 className="font-semibold text-verde-profundo">Adicionar vendedor</h3>
      <input
        placeholder="Nome completo"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
      />
      <input
        placeholder="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
      />
      <div className="flex gap-2">
        {(["seller", "treasurer", "admin"] as UserRole[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`tap-target flex-1 rounded-xl py-2 text-sm font-semibold ${
              role === r ? "bg-verde-profundo text-off-white" : "bg-creme text-verde-profundo"
            }`}
          >
            {r === "seller" ? "Vendedor" : r === "treasurer" ? "Tesoureiro" : "Admin"}
          </button>
        ))}
      </div>
      {error && <p className="text-sm font-medium text-terracota">{error}</p>}
      <ActionButton
        label="Adicionar vendedor"
        labelDoing="Enviando convite..."
        labelDone="Convite enviado ✓"
        onAction={handleInvite}
      />
    </div>
  );
}
