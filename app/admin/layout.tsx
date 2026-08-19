import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "./Sidebar";
import AdminShell from "@/components/AdminShell";
import { getDashboardMetrics } from "@/lib/sheets";

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
      {children}
    </AdminShell>
  );
}