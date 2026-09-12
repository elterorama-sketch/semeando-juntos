"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";
import type { Congregation, Profile } from "@/lib/database.types";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", treasurer: "Tesoureiro", seller: "Vendedor" };

export default function UsersList({
  users,
  congregations = [],
}: {
  users: Profile[];
  congregations?: Congregation[];
}) {
  const router = useRouter();
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
        <div key={u.id} className="flex items-center justify-between rounded-lg bg-creme p-3">
          <div>
            <p className="font-medium text-verde-profundo">{u.full_name}</p>
            <p className="text-xs text-verde-oliva">
              {ROLE_LABEL[u.role] ?? u.role}
              {congregationName(u.congregation_id) ? ` · ${congregationName(u.congregation_id)}` : ""}
            </p>
          </div>
          <div className="w-32">
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
      ))}
    </div>
  );
}
