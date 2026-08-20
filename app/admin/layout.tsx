import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "./Sidebar";
import AdminShell from "@/components/AdminShell";
import NotificationInitializer from "@/app/notification/NotificationInitializer"; 

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user?.role !== "admin") redirect("/dashboard");

  return (
    <AdminShell sidebar={<Sidebar user={session?.user} />}>
      {/* ★ 管理者レイアウトの配下に入ったタイミングで通知の初期化を実行 */}
      <NotificationInitializer />
      {children}
    </AdminShell>
  );
}