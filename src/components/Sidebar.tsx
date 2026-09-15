"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/database.types";

const ITEMS: { href: string; label: string; icon: string; roles: UserRole[] }[] = [
  { href: "/", label: "Início", icon: "🏠", roles: ["admin", "treasurer", "seller"] },
  { href: "/numeros", label: "Números", icon: "🔢", roles: ["admin", "treasurer", "seller"] },
  { href: "/minhas-vendas", label: "Minhas vendas", icon: "🧾", roles: ["admin", "seller"] },
  { href: "/compradores", label: "Compradores", icon: "👤", roles: ["admin", "treasurer", "seller"] },
  { href: "/tesouraria", label: "Tesouraria", icon: "💰", roles: ["admin", "treasurer"] },
  { href: "/ranking", label: "Ranking", icon: "🏆", roles: ["admin", "treasurer"] },
  { href: "/relatorios", label: "Relatórios", icon: "📊", roles: ["admin"] },
  { href: "/sorteio", label: "Sorteio", icon: "🎁", roles: ["admin"] },
  { href: "/auditoria", label: "Auditoria", icon: "📜", roles: ["admin"] },
  { href: "/configuracoes", label: "Configurações", icon: "⚙️", roles: ["admin"] },
];

export default function Sidebar({ role, name }: { role: UserRole; name: string }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-verde-oliva/15 bg-off-white p-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="text-xl" aria-hidden>
          🌱
        </span>
        <span className="font-bold text-verde-profundo">Semeando Juntos</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-verde-profundo text-off-white"
                  : "text-verde-profundo hover:bg-creme"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-verde-oliva/15 px-2 pt-3 text-xs text-verde-profundo/75">
        <p className="truncate font-medium text-verde-profundo">{name}</p>
        <p className="capitalize">{role === "admin" ? "administrador" : role === "treasurer" ? "tesoureiro" : "cooperador"}</p>
      </div>
    </aside>
  );
}
