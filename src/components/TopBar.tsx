"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TopBar({ title }: { title: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-verde-oliva/15 bg-off-white/95 px-4 py-3 backdrop-blur md:px-6">
      <h1 className="text-lg font-bold text-verde-profundo">{title}</h1>
      <button
        type="button"
        onClick={handleSignOut}
        className="tap-target rounded-lg px-3 py-2 text-sm font-medium text-verde-oliva hover:bg-creme"
      >
        Sair
      </button>
    </header>
  );
}
