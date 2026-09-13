"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ActionButton from "@/components/ActionButton";
import type { Congregation, UserRole } from "@/lib/database.types";

export default function InviteUserForm({ congregations }: { congregations: Congregation[] }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("seller");
  const [congregationId, setCongregationId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; login: string; password: string } | null>(
    null
  );
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  async function handleCreate() {
    setError(null);
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        whatsapp,
        email: email || null,
        role,
        congregationId: congregationId || null,
      }),
    });
    const json = await res.json().catch(() => ({ error: "Erro inesperado do servidor." }));
    if (!res.ok) {
      setError(json.error ?? "Erro ao criar usuário.");
      throw new Error(json.error);
    }
    setCreated({ name: fullName, login: json.login, password: json.password });
    setFullName("");
    setWhatsapp("");
    setEmail("");
    setCongregationId("");
    router.refresh();
  }

  const shareText = created
    ? `Acesso ao app Semeando Juntos, ${created.name}:\nLogin: ${created.login}\nSenha: ${created.password}`
    : "";

  async function handleCopy() {
    await navigator.clipboard.writeText(shareText);
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 1800);
  }

  if (created) {
    return (
      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
        <h3 className="font-semibold text-verde-profundo">Usuário criado ✓</h3>
        <p className="text-sm text-verde-oliva">
          Envie esses dados de acesso para {created.name} (por WhatsApp, por exemplo). Essa senha só
          aparece aqui uma vez.
        </p>
        <div className="rounded-xl bg-creme p-3 text-sm">
          <p>
            <span className="font-semibold text-verde-profundo">Login:</span> {created.login}
          </p>
          <p>
            <span className="font-semibold text-verde-profundo">Senha:</span> {created.password}
          </p>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleCopy}
            className="tap-target w-full rounded-xl bg-terracota py-3 font-semibold uppercase tracking-wide text-off-white hover:bg-terracota/90"
          >
            {copyState === "copied" ? "Copiado ✓" : "Copiar login e senha"}
          </button>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="tap-target w-full rounded-xl py-3 font-semibold uppercase tracking-wide text-verde-oliva hover:bg-creme/40"
          >
            Adicionar outro usuário
          </button>
        </div>
      </div>
    );
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
        placeholder="WhatsApp"
        inputMode="tel"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
      />
      <div>
        <input
          placeholder="E-mail (opcional)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
        <p className="mt-1 text-xs text-verde-oliva">
          Sem e-mail, o WhatsApp vira o login de acesso automaticamente.
        </p>
      </div>
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
      <div>
        <label htmlFor="invite-congregation" className="mb-1 block text-sm font-medium text-verde-profundo">
          Congregação (opcional)
        </label>
        <select
          id="invite-congregation"
          value={congregationId}
          onChange={(e) => setCongregationId(e.target.value)}
          className="tap-target w-full rounded-xl border border-verde-oliva/30 bg-white px-4 py-3 outline-none focus:border-verde-profundo"
        >
          <option value="">Sem congregação</option>
          {congregations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm font-medium text-terracota">{error}</p>}
      <ActionButton
        label="Criar usuário"
        labelDoing="Criando..."
        labelDone="Criado ✓"
        onAction={handleCreate}
      />
    </div>
  );
}
