import Sidebar from "./Sidebar";
import AdminShell from "@/components/AdminShell";
import { requireAdmin } from "@/lib/guards";
import NotificationInitializer from "@/app/notification/NotificationInitializer";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <>
      <NotificationInitializer />
      <AdminShell sidebar={<Sidebar user={session.user} />}>
        {children}
      </AdminShell>
    </>
  );
}
