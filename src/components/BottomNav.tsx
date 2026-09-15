"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/database.types";

const ITEMS = [
  { href: "/", label: "Início", icon: "🏠", roles: ["admin", "treasurer", "seller"] as UserRole[] },
  { href: "/numeros", label: "Números", icon: "🔢", roles: ["admin", "treasurer", "seller"] as UserRole[] },
  { href: "/numeros?vender=1", label: "Vender", icon: "➕", roles: ["admin", "seller"] as UserRole[], highlight: true },
  { href: "/minhas-vendas", label: "Minhas vendas", icon: "🧾", roles: ["admin", "seller"] as UserRole[] },
  { href: "/mais", label: "Mais", icon: "⋯", roles: ["admin", "treasurer", "seller"] as UserRole[] },
];

export default function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-verde-oliva/15 bg-off-white/95 backdrop-blur md:hidden">
      {items.map((item) => {
        const isActive = pathname === item.href.split("?")[0];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`tap-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
              item.highlight
                ? "text-off-white"
                : isActive
                  ? "text-verde-profundo"
                  : "text-verde-profundo/75"
            }`}
          >
            {item.highlight ? (
              <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-terracota text-xl text-off-white shadow-lg">
                {item.icon}
              </span>
            ) : (
              <span className="text-lg" aria-hidden>
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
