"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// The seller-facing login is whatever they were handed: usually just their
// WhatsApp number, sometimes a real email (see /api/admin/invite). Supabase
// auth always needs an email as the account key, so plain digits get the
// same synthetic domain appended here that the invite route used to create
// the account -- the seller never has to know or type that suffix.
function toEmail(login: string): string {
  const trimmed = login.trim();
  const digits = trimmed.replace(/\D/g, "");
  const looksLikeEmail = trimmed.includes("@");
  if (!looksLikeEmail && digits.length >= 8) {
    return `${digits}@semeando-juntos.app`;
  }
  return trimmed;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(login),
      password,
    });
    if (error) {
      setStatus("error");
      setErrorMsg("Login ou senha incorretos.");
      return;
    }
    router.replace(searchParams.get("next") || "/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-off-white px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-verde-profundo text-2xl text-off-white">
            🌱
          </div>
          <h1 className="text-2xl font-bold text-verde-profundo">Semeando Juntos</h1>
          <p className="mt-1 text-sm text-verde-oliva">Acesso restrito a cooperadores autorizados</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login" className="mb-1 block text-sm font-medium text-verde-profundo">
              WhatsApp ou e-mail
            </label>
            <input
              id="login"
              type="text"
              inputMode="email"
              placeholder="Ex: 11999998888 ou seu@email.com"
              required
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="tap-target w-full rounded-xl border border-verde-oliva/30 bg-white px-4 py-3 text-verde-profundo outline-none focus:border-verde-profundo focus:ring-2 focus:ring-verde-profundo/20"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-verde-profundo">
              Senha (código de 6 dígitos)
            </label>
            <input
              id="password"
              type="password"
              inputMode="numeric"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="tap-target w-full rounded-xl border border-verde-oliva/30 bg-white px-4 py-3 text-verde-profundo outline-none focus:border-verde-profundo focus:ring-2 focus:ring-verde-profundo/20"
            />
          </div>

          {status === "error" && (
            <p role="alert" className="text-sm font-medium text-terracota">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="tap-target w-full rounded-xl bg-verde-profundo py-3 font-semibold uppercase tracking-wide text-off-white transition hover:bg-verde-profundo/90 disabled:opacity-60"
          >
            {status === "loading" ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-verde-profundo/75">
          Não tem acesso? Peça a um administrador para te cadastrar.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
