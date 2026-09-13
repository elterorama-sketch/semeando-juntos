"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";

// Sellers get a random 6-digit PIN generated for them (see
// /api/admin/invite) -- this lets anyone swap it for something they'll
// actually remember, using their own active session. No admin key needed:
// auth.updateUser() only ever touches the currently signed-in account.
export default function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleChange() {
    setError(null);
    if (newPassword.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      throw new Error("validation");
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      throw new Error("validation");
    }
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError("Erro ao trocar a senha. Tente novamente.");
      throw updateError;
    }
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
      <h3 className="font-semibold text-verde-profundo">Alterar senha</h3>
      <div>
        <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-verde-profundo">
          Nova senha
        </label>
        <input
          id="new-password"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
      </div>
      <div>
        <label
          htmlFor="confirm-password"
          className="mb-1 block text-sm font-medium text-verde-profundo"
        >
          Confirmar nova senha
        </label>
        <input
          id="confirm-password"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
      </div>
      {error && <p className="text-sm font-medium text-terracota">{error}</p>}
      <ActionButton
        label="Salvar nova senha"
        labelDoing="Salvando..."
        labelDone="Senha alterada ✓"
        onAction={handleChange}
      />
    </div>
  );
}
