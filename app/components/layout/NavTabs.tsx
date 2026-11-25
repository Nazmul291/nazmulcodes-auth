import { NavLink } from "@remix-run/react";
import type { ReactNode } from "react";
import { cn } from "../ui/cn";

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

export function NavTabs({ items }: { items: NavItem[] }) {
  return (
    <nav className="-mb-px flex gap-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors",
              isActive ? "border-neutral-100 text-neutral-100" : "border-transparent text-neutral-500 hover:text-neutral-200",
            )
          }
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
