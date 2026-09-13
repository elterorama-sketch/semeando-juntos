import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Deletes a user from auth.users -- profiles cascades via its FK (see
// 0002_tables.sql: "id uuid primary key references auth.users(id) on
// delete cascade"). If that user has orders/payments/draws tied to them,
// the profiles row is still referenced by those tables (no cascade there
// on purpose), so Postgres rejects the delete with a foreign-key error --
// which we surface as "desative em vez de excluir" rather than letting a
// generic 500 through.
export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado ao excluir usuário.";
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
    return NextResponse.json({ error: "Apenas administradores podem excluir usuários." }, { status: 403 });
  }

  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
  }
  if (userId === user.id) {
    return NextResponse.json({ error: "Você não pode excluir a própria conta." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    // Supabase's Admin API wraps a Postgres FK-violation as the generic
    // "Database error deleting user" -- it never actually says "foreign
    // key" or "violat..." in the message we get here (confirmed testing
    // against production: a user referenced by customers.created_by hit
    // exactly this string). Treat that phrase as the FK case too.
    const message = /foreign key|violat|database error deleting user/i.test(deleteError.message)
      ? "Esse usuário está vinculado a registros do sistema (vendas, pagamentos, clientes cadastrados, sorteios, etc.) e não pode ser excluído. Desative-o em vez disso."
      : deleteError.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
