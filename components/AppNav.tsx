"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HOME, MENU } from "@/lib/menu";

/** nav tab */
export default function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const tabs = [
    HOME,
    ...MENU.filter((m) => m.ready && (!m.adminOnly || isAdmin)) // not ready = no tab
      .map((m) => ({ href: m.href, navLabel: m.navLabel, Icon: m.Icon })),
  ];

  return (
    <nav className="app-nav">
      {tabs.map(({ href, navLabel, Icon }) => {
        const on = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`nav-tab ${on ? "nav-tab-on" : ""}`}
          >
            <Icon size={14} aria-hidden="true" />
            {navLabel}
          </Link>
        );
      })}
    </nav>
  );
}