import Sidebar from "./Sidebar";
import AdminShell from "@/components/AdminShell";
import { requireAdmin } from "@/lib/guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <AdminShell sidebar={<Sidebar user={session.user} />}>
      {children}
    </AdminShell>
  );
}
