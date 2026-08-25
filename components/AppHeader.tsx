"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="app-header">
      <div>
        <p className="text-sm font-medium leading-tight">名古屋中支部</p>
        <p className="text-[10px] opacity-80">名古屋税理士会</p>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="btn btn-ghost px-2 py-1 text-[11px]"
      >
        <LogOut size={16} aria-hidden="true" />
        ログアウト
      </button>
    </header>
  );
}
