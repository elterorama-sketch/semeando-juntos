import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/database.types";

// Church volunteers mostly don't have (or check) an inbox they'd trust for
// an account-activation email, and this project has no SMTP provider
// configured -- an email-link invite would silently never arrive for most
// sellers. So instead of inviteUserByEmail(), the admin sets a password
// directly here and hands it to the seller in person/WhatsApp. A synthetic
// email (derived from the WhatsApp number) is used as the login identifier
// when no real email is given -- it never needs to receive mail, Supabase
// auth just requires *some* unique email as the account key.
function generatePassword(): string {
  // Avoids visually ambiguous characters (0/O, 1/I/l) since this is meant
  // to be read aloud or typed from a WhatsApp message on a phone keyboard.
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Invite-only user creation. Public signup is intentionally not exposed
// anywhere in the app -- this is the single path for adding sellers,
// treasurers or admins, and it requires an authenticated admin caller.
export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    // A thrown error here (e.g. createAdminClient() failing because
    // SUPABASE_SERVICE_ROLE_KEY isn't set) would otherwise surface as a
    // bare Next.js 500 HTML page, which breaks res.json() client-side and
    // hides the real cause behind a generic "ERRO" button. Always answer
    // with JSON so the admin sees an actionable message.
    const message = err instanceof Error ? err.message : "Erro inesperado ao criar usuário.";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      // Temporary diagnostic (no secret values, just presence/shape) so the
      // exact env-var mismatch can be found from the error message itself,
      // without needing a Vercel dashboard screenshot.
      const keyLen = process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0;
      return NextResponse.json(
        {
          error: `Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY não chegou a este deployment (ambiente: ${
            process.env.VERCEL_ENV ?? "desconhecido"
          }, tamanho lido: ${keyLen}).`,
        },
        { status: 500 }
      );
    }
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

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Apenas administradores podem convidar usuários." }, { status: 403 });
  }

  const body = await request.json();
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
  const emailInput = typeof body.email === "string" ? body.email.trim() : "";
  const role = body.role as UserRole;
  const congregationId = typeof body.congregationId === "string" ? body.congregationId : null;

  if (!fullName || !whatsapp || !["admin", "treasurer", "seller"].includes(role)) {
    return NextResponse.json({ error: "Informe nome, WhatsApp e papel." }, { status: 400 });
  }

  const whatsappDigits = whatsapp.replace(/\D/g, "");
  if (whatsappDigits.length < 8) {
    return NextResponse.json({ error: "WhatsApp inválido." }, { status: 400 });
  }

  const email = emailInput || `${whatsappDigits}@semeando-juntos.app`;
  const password = generatePassword();

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    const message =
      createError?.message.includes("already been registered") ||
      createError?.message.includes("already registered")
        ? "Já existe um usuário com esse WhatsApp/e-mail."
        : (createError?.message ?? "Erro ao criar usuário.");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    phone: whatsapp,
    role,
    active: true,
    congregation_id: congregationId,
  });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, email, password });
}
