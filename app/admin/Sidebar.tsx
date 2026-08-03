"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarProps = {
  user?: {
    name?: string | null;
    email?: string | null;
  };
};

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  
  // 初期値を 0 にして取得完了までバッジを出さない
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // 未読バッジ件数をAPIから自動取得
  useEffect(() => {
    async function fetchUnreadCount() {
      try {
        const res = await fetch("/api/admin/unread-count");
        const data = await res.json();
        if (data.success && typeof data.count === "number") {
          setUnreadCount(data.count);
        }
      } catch (err) {
        console.error("未読バッジ件数の取得に失敗しました:", err);
      }
    }

    // 初回表示時に即時取得
    fetchUnreadCount();

    // 60秒周期でバックグラウンド更新
    const interval = setInterval(fetchUnreadCount, 60000);

    // 即時更新イベントリスナー
    const handleUnreadUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ unreadCount: number }>;
      if (customEvent.detail && typeof customEvent.detail.unreadCount === "number") {
        setUnreadCount(customEvent.detail.unreadCount);
      }
    };

    window.addEventListener("unread-count-updated", handleUnreadUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("unread-count-updated", handleUnreadUpdate);
    };
  }, []);

  // メニューの定義
  const navItems = [
    { label: "ダッシュボード", href: "/admin" },
    { label: "ユーザー管理", href: "/admin/users" },
    { label: "グループ管理", href: "/admin/groups" },
    { label: "イベント管理", href: "/admin/events" },
    {
      label: "メッセージ送信",
      href: "/admin/messages",
      badge: unreadCount > 0 ? unreadCount : null,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col justify-between shrink-0 sticky top-0 h-screen">
      <div>
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-lg font-bold tracking-wide">管理システム</h1>
        </div>

        <nav className="p-4 flex flex-col gap-1.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white font-semibold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span>{item.label}</span>

                {item.badge !== null && item.badge !== undefined && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        <div className="px-2 py-1">
          <p className="text-xs text-slate-400">ログイン中</p>
          <p className="text-sm font-semibold text-slate-200 truncate mt-0.5">
            {user?.name || "管理者ユーザー"}
          </p>
          {user?.email && (
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          )}
        </div>
      </div>
    </aside>
  );
}