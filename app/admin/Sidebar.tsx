"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type SidebarProps = {
  unreadCount?: number;
  user?: {
    name?: string | null;
    email?: string | null;
  };
};

export default function Sidebar({ unreadCount = 0, user }: SidebarProps) {
  const pathname = usePathname();

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
    <aside className="w-64 bg-brand text-white min-h-screen flex flex-col justify-between shrink-0 sticky top-0 h-screen">
      <div>
        {/* ヘッダー・タイトル */}
        <div className="p-6 border-b border-chrome-line">
          <h1 className="text-lg font-bold tracking-wide">管理システム</h1>
        </div>

        {/* ナビゲーションメニュー */}
        <nav className="p-4 flex flex-col gap-1.5">
          {navItems.map((item) => {
            // 💡 ここを変更：ダッシュボード（/admin）は完全一致、その他は前方一致で判定
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
                    ? "bg-chrome text-white font-semibold"
                    : "text-white/70 hover:bg-chrome hover:text-white"
                }`}
              >
                <span>{item.label}</span>

                {/* 未読メッセージ数のバッジ */}
                {item.badge !== null && item.badge !== undefined && (
                  <span className="badge">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        {/* 会員側ページへ（管理ゾーンの外に出るリンク） */}
        <div className="mx-4 border-t border-chrome-line pt-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-chrome hover:text-white"
          >
            <span>一般会員ページを表示</span>
            <span aria-hidden>↗</span>
          </Link>
        </div>
      </div>

      {/* フッター：ログイン中のユーザー情報 */}
      <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">ログイン中</p>
            <p className="text-sm font-semibold text-slate-200 truncate mt-0.5">
              {user?.name || "管理者ユーザー"}
            </p>
            {user?.email && (
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="shrink-0 rounded-control border border-white px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500 hover:border-red-500"
            >
            ログアウト
          </button>
      </div>
    </aside>
  );
}