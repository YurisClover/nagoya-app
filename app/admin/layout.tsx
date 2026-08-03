import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "./Sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if(!session) redirect("/login");
  if(session.user?.role !== "admin") redirect("/dashboard");

  // ★ getDashboardMetrics の呼び出しおよび unreadCount の受け渡しを削除
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* user のみ渡す */}
      <Sidebar user={session?.user} />

      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}