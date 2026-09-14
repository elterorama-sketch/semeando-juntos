"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";
import type { Congregation, Profile, UserRole } from "@/lib/database.types";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", treasurer: "Tesoureiro", seller: "Cooperador" };
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
            <UserRow
              user={u}
              congregations={congregations}
              onEdit={() => setEditingId(u.id)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Each row owns its own reveal/confirm-delete state -- these came from a
// real bug in production: with that state hoisted to the list (one shared
// confirmDeleteId/deleteError for every row), a slow response for one
// user's delete could resolve *after* the admin had already opened another
// user's confirm panel, and its error text would render there instead --
// e.g. a stale/mismatched message showing up under the wrong account.
function UserRow({
  user: u,
  congregations,
  onEdit,
}: {
  user: Profile;
  congregations: Congregation[];
  onEdit: () => void;
}) {
  const router = useRouter();
  const congregationName = (id: string | null) => congregations.find((c) => c.id === id)?.name;

  const [revealed, setRevealed] = useState<{ login: string; password: string } | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function toggleActive() {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ active: !u.active }).eq("id", u.id);
    if (error) throw error;
    router.refresh();
  }

  async function handleRevealPassword() {
    setRevealError(null);
    setShowReveal(true);
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id }),
    });
    const json = await res.json().catch(() => ({ error: "Erro inesperado do servidor." }));
    if (!res.ok) {
      setRevealError(json.error ?? "Erro ao gerar senha.");
      setRevealed(null);
      throw new Error(json.error);
    }
    setRevealed({ login: json.login, password: json.password });
  }

  async function handleDelete() {
    setDeleteError(null);
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id }),
    });
    const json = await res.json().catch(() => ({ error: "Erro inesperado do servidor." }));
    if (!res.ok) {
      setDeleteError(json.error ?? "Erro ao excluir usuário.");
      throw new Error(json.error);
    }
    setConfirmDelete(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-verde-profundo">{u.full_name}</p>
          <p className="text-xs text-verde-oliva">
            {ROLE_LABEL[u.role] ?? u.role}
            {congregationName(u.congregation_id) ? ` · ${congregationName(u.congregation_id)}` : ""}
            {!u.active ? " · inativo" : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="tap-target rounded-xl bg-white px-3 py-2 text-sm font-semibold text-verde-profundo"
        >
          Editar
        </button>
        <div className="w-40">
          <ActionButton
            label="Exibir senha inicial"
            labelDoing="Gerando..."
            labelDone="Gerada ✓"
            variant="secondary"
            fullWidth
            onAction={handleRevealPassword}
          />
        </div>
        <div className="w-28">
          <ActionButton
            label={u.active ? "Desativar" : "Ativar"}
            labelDoing="Salvando..."
            labelDone="Feito ✓"
            variant={u.active ? "danger" : "secondary"}
            fullWidth
            onAction={toggleActive}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setConfirmDelete(true);
          }}
          className="tap-target rounded-xl bg-white px-3 py-2 text-sm font-semibold text-terracota"
        >
          Excluir
        </button>
      </div>
      {confirmDelete && (
        <div className="space-y-2 rounded-xl bg-terracota/10 p-3">
          <p className="text-sm font-medium text-terracota">
            Excluir {u.full_name} definitivamente? Essa ação não pode ser desfeita. Se esse usuário já
            tiver vendas registradas, use &quot;Desativar&quot; em vez disso.
          </p>
          {deleteError && <p className="text-sm font-medium text-terracota">{deleteError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="tap-target flex-1 rounded-xl bg-white py-2 text-sm font-semibold text-verde-profundo"
            >
              Cancelar
            </button>
            <div className="flex-1">
              <ActionButton
                label="Confirmar exclusão"
                labelDoing="Excluindo..."
                labelDone="Excluído ✓"
                variant="danger"
                fullWidth
                onAction={handleDelete}
              />
            </div>
          </div>
        </div>
      )}
      {showReveal && (
        <div className="rounded-xl bg-white p-3 text-sm">
          {revealed ? (
            <>
              <p className="text-xs text-verde-oliva">
                Nova senha provisória gerada para {u.full_name}. Envie por WhatsApp -- ela substitui a
                anterior e só aparece aqui agora.
              </p>
              <p className="mt-1">
                <span className="font-semibold text-verde-profundo">Login:</span> {revealed.login}
              </p>
              <p>
                <span className="font-semibold text-verde-profundo">Senha provisória:</span>{" "}
                {revealed.password}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-terracota">{revealError}</p>
          )}
        </div>
      )}
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
