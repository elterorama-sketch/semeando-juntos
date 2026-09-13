import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function MaisPage() {
  const profile = await getCurrentProfile();
  const role = profile?.role ?? "seller";

  const items = [
    { href: "/compradores", label: "Compradores", icon: "👤", roles: ["admin", "treasurer", "seller"] },
    { href: "/tesouraria", label: "Tesouraria", icon: "💰", roles: ["admin", "treasurer"] },
    { href: "/ranking", label: "Ranking de vendedores", icon: "🏆", roles: ["admin", "treasurer"] },
    { href: "/relatorios", label: "Relatórios", icon: "📊", roles: ["admin"] },
    { href: "/sorteio", label: "Sorteio", icon: "🎁", roles: ["admin"] },
    { href: "/auditoria", label: "Auditoria", icon: "📜", roles: ["admin"] },
    { href: "/configuracoes", label: "Configurações", icon: "⚙️", roles: ["admin"] },
    { href: "/senha", label: "Alterar senha", icon: "🔑", roles: ["admin", "treasurer", "seller"] },
  ].filter((item) => item.roles.includes(role));

  return (
    <>
      <TopBar title="Mais" />
      <main className="flex-1 space-y-2 p-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="tap-target flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10"
          >
            <span className="text-xl" aria-hidden>
              {item.icon}
            </span>
            <span className="font-medium text-verde-profundo">{item.label}</span>
          </Link>
        ))}
      </main>
    </>
  );
}
