import Sidebar from "./Sidebar";
import { getDashboardMetrics } from "@/lib/sheets";
import { auth } from "@/auth"; 

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const metrics = await getDashboardMetrics();
  const unreadCount = metrics.unreadMessagesCount;

  // 💡 getServerSession の代わりに await auth() を呼び出すだけ！引数(authOptions)も不要です
  const session = await auth();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 左側：ずっと表示されるサイドバー（ユーザー情報を渡す） */}
      <Sidebar unreadCount={unreadCount} user={session?.user} />

      {/* 右側：各ページのコンテンツが切り替わるエリア */}
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}