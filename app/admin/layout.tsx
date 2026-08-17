import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "./Sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user?.role !== "admin") redirect("/dashboard");
  // validate before SHEET API
  const metrics = await getDashboardMetrics();
  const unreadCount = metrics.unreadMessagesCount;

  // ★ getDashboardMetrics の呼び出しおよび unreadCount の受け渡しを削除
  return (
    <AdminShell sidebar={<Sidebar unreadCount={unreadCount} user={session?.user} />}>
      {children}
    </AdminShell>
  );
}