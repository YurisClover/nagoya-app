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
  // validate before SHEET API
  const metrics = await getDashboardMetrics();
  const unreadCount = metrics.unreadMessagesCount;

  return (
    <AdminShell sidebar={<Sidebar unreadCount={unreadCount} user={session?.user} />}>
      {children}
    </AdminShell>
  );
}