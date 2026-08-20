import Link from "next/link";
import AppShell from "@/components/AppShell";
import { MENU, type MenuItem } from "@/lib/menu";
import { requireUser } from "@/lib/guards";
import NotificationInitializer from "@/app/notification/NotificationInitializer";
import { getDashboardMetrics } from "@/lib/sheets"; // ★ sheets.ts からインポート

function MenuCard({ item, unreadCount }: { item: MenuItem; unreadCount?: number }) {
  const { Icon } = item;
  const span = item.wide ? "col-span-2" : "";

  // メッセージのリンク（環境に合わせて "/messages" などのパスに変更してください）
  const isMessageItem = item.href === "/messages"; 

  const inner = (
    <>
      {/* アイコンの親要素に relative を付与してバッジの位置基準にする */}
      <div className={`icon-tile ${item.tone} relative`}>
        <Icon className="h-[17px] w-[17px] sm:h-5 sm:w-5" aria-hidden="true" />
        
        {/* ★ メッセージかつ未読数が1件以上の場合に赤丸バッジを表示 */}
        {isMessageItem && unreadCount && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-ink sm:text-sm">{item.label}</p>
      <p className="mt-[2px] text-[10px] text-ink-muted sm:text-xs">{item.desc}</p>
    </>
  );

  if (!item.ready) {
    return (
      <div aria-disabled="true" className={`card-disabled ${span}`}>
        <span className="badge-muted absolute right-2 top-2">準備中</span>
        {inner}
      </div>
    );
  }

  return <Link href={item.href} className={`card-tap ${span}`}>{inner}</Link>;
}

export default async function HomePage() {
  const session = await requireUser();

  const isAdmin = session.user.role === "admin";
  const items = MENU.filter((m) => !m.adminOnly || isAdmin);

  // ★ ログイン中のユーザーIDを渡して、自分宛ての未読数を取得
  const metrics = await getDashboardMetrics(session.user.id ?? "");
  const unreadMessagesCount = metrics.unreadMessagesCount;

  return (
    <AppShell>
      {/* ダッシュボード画面でのみ通知初期化（トークン取得・サーバー保存）を実行 */}
      <NotificationInitializer />

      <section className="card-brand mb-4">
        <p className="text-[15px] font-medium sm:text-lg">{session.user.name} 様</p>
        <p className="mt-1 text-[11px] opacity-80 sm:text-sm">名古屋中支部 会員</p>
        <span className="chip mt-2">会員番号：{session.user.id}</span>
      </section>

      <h2 className="section-title">メニュー</h2>
      <div className="grid grid-cols-2 gap-[9px] sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <MenuCard 
            key={item.href} 
            item={item} 
            unreadCount={unreadMessagesCount} // ★ 各カードに未読数を渡す
          />
        ))}
      </div>
    </AppShell>
  );
}