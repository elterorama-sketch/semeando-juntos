import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Generates a fresh 6-digit PIN for an existing user and overwrites their
// password with it -- the only way an admin can recover/re-display access
// once the one-time reveal in InviteUserForm has been dismissed, since
// Supabase never returns an existing password in plaintext.
function generatePassword(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += Math.floor(Math.random() * 10);
  return out;
}

export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado ao gerar senha.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handle(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: callerProfile, error: callerProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfileError) {
    // A failed lookup here is not the same thing as "not an admin" -- don't
    // collapse the two, or a transient query error gets misreported as a
    // permissions error and sends the admin chasing the wrong problem.
    return NextResponse.json(
      { error: `Erro ao verificar permissões, tente novamente: ${callerProfileError.message}` },
      { status: 500 }
    );
  }
  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Apenas administradores podem gerar senhas." }, { status: 403 });
  }

  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const password = generatePassword();
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  if (updateError || !updated.user) {
    return NextResponse.json(
      { error: updateError?.message ?? "Erro ao gerar senha." },
      { status: 400 }
    );
  }

  const email = updated.user.email ?? "";
  const login = email.endsWith("@semeando-juntos.app") ? email.split("@")[0] : email;

  return NextResponse.json({ ok: true, login, password });
}
