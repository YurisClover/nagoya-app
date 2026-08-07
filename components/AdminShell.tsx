"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

export default function AdminShell({
    sidebar,
    children,
}: {
    sidebar: React.ReactNode;
    children: React.ReactNode;
}) {
    const [ open, setOpen ] = useState(false);

    return (
    <div className="theme-body flex min-h-screen">
      {/* big screen -> left sidebar */}
      <div className="hidden lg:block">{sidebar}</div>

      {/* small screen: drawer open/close — after click (sidebar or bg) -> auto-hide */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 z-50" onClick={() => setOpen(false)}>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar only for small screen */}
        <header className="flex items-center gap-3 bg-brand px-4 py-3 text-white lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="メニューを開く"
            className="btn-ghost rounded-control p-1.5"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold">管理画面</span>
        </header>

        {/* every admin pages are in same container (same size and position) */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-container-admin">{children}</div>
        </main>
      </div>
    </div>
  );
}