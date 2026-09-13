"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";
import type { Congregation, Profile, UserRole } from "@/lib/database.types";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", treasurer: "Tesoureiro", seller: "Vendedor" };
const ROLE_OPTIONS: UserRole[] = ["seller", "treasurer", "admin"];

export default function UsersList({
  users,
  congregations = [],
}: {
  users: Profile[];
  congregations?: Congregation[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const congregationName = (id: string | null) => congregations.find((c) => c.id === id)?.name;

  async function toggleActive(user: Profile) {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ active: !user.active })
      .eq("id", user.id);
    if (error) throw error;
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
      <h3 className="font-semibold text-verde-profundo">Usuários</h3>
      {users.map((u) => (
        <div key={u.id} className="rounded-lg bg-creme p-3">
          {editingId === u.id ? (
            <EditUserForm
              user={u}
              congregations={congregations}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                router.refresh();
              }}
            />
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-verde-profundo">{u.full_name}</p>
                <p className="text-xs text-verde-oliva">
                  {ROLE_LABEL[u.role] ?? u.role}
                  {congregationName(u.congregation_id) ? ` · ${congregationName(u.congregation_id)}` : ""}
                  {!u.active ? " · inativo" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(u.id)}
                  className="tap-target rounded-xl bg-white px-3 py-2 text-sm font-semibold text-verde-profundo"
                >
                  Editar
                </button>
                <div className="w-28">
                  <ActionButton
                    label={u.active ? "Desativar" : "Ativar"}
                    labelDoing="Salvando..."
                    labelDone="Feito ✓"
                    variant={u.active ? "danger" : "secondary"}
                    fullWidth
                    onAction={() => toggleActive(u)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EditUserForm({
  user,
  congregations,
  onCancel,
  onSaved,
}: {
  user: Profile;
  congregations: Congregation[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState<UserRole>(user.role);
  const [congregationId, setCongregationId] = useState(user.congregation_id ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!fullName.trim()) {
      setError("Informe o nome.");
      throw new Error("validation");
    }
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        role,
        congregation_id: congregationId || null,
      })
      .eq("id", user.id);
    if (updateError) {
      setError("Erro ao salvar. Tente novamente.");
      throw updateError;
    }
    onSaved();
  }

  return (
    <div className="space-y-2">
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="tap-target w-full rounded-xl border border-verde-oliva/30 bg-white px-4 py-3 outline-none focus:border-verde-profundo"
      />
      <div className="flex gap-2">
        {ROLE_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`tap-target flex-1 rounded-xl py-2 text-xs font-semibold ${
              role === r ? "bg-verde-profundo text-off-white" : "bg-white text-verde-profundo"
            }`}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      {congregations.length > 0 && (
        <select
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
      )}
      {error && <p className="text-sm font-medium text-terracota">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="tap-target flex-1 rounded-xl bg-white py-2 text-sm font-semibold text-verde-profundo"
        >
          Cancelar
        </button>
        <div className="flex-1">
          <ActionButton label="Salvar" labelDoing="Salvando..." labelDone="Salvo ✓" onAction={handleSave} />
        </div>
      </div>
    </div>
  );
}
