import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "./Sidebar";
import { getDashboardMetrics } from "@/lib/sheets";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if(!session) redirect("/login");
  if(session.user?.role !== "admin") redirect("/dashboard");
  // validate before SHEET API
  const metrics = await getDashboardMetrics();
  const unreadCount = metrics.unreadMessagesCount;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 左側：ずっと表示されるサイドバー（ユーザー情報を渡す） */}
      <Sidebar unreadCount={unreadCount} user={session?.user} />

      {/* 右側：各ページのコンテンツが切り替わるエリア */}
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}