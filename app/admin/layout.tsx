import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "./Sidebar";
import AdminShell from "@/components/AdminShell";
import { getDashboardMetrics } from "@/lib/sheets";
import NotificationInitializer from "@/app/notification/NotificationInitializer"; // ★ 追加

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user?.role !== "admin") redirect("/dashboard");

  // ★ サーバー側で最初の未読数を取得する
  const metrics = await getDashboardMetrics();
  const initialUnreadCount = metrics.unreadMessagesCount || 0;

  return (
    <AdminShell sidebar={<Sidebar initialUnreadCount={initialUnreadCount} user={session?.user} />}>
      {/* ★ 管理者レイアウトの配下に入ったタイミングで通知の初期化を実行 */}
      <NotificationInitializer />
      {children}
    </AdminShell>
  );
}