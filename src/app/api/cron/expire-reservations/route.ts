import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Hit periodically by Vercel Cron (see vercel.json) so reservations expire
// even when nobody happens to open the app to trigger the lazy check that
// also runs inside reserve_numbers().
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("expire_stale_reservations");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expired: data });
}
