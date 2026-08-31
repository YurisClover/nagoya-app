/**
 * Admin messages page (/admin/messages). Server wrapper: requireAdmin,
 * resolves ?group= (preselects a group when arriving from the groups
 * page "send" link) and the admin's own member id, then renders
 * AdminMessagesClient. The member id is threaded down so send targets
 * can exclude the sender.
 */
import { requireAdmin } from "@/lib/guards";
import AdminMessagesClient from "./AdminMessagesClient";

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  // レイアウトでも requireAdmin しているが、チームの他ページと同じく
  // ページ単体でも守る(defense in depth)。セッションから会員IDも取る。
  const session = await requireAdmin();
  const { group } = await searchParams;

  return (
    <AdminMessagesClient
      currentUserId={session.user?.id ?? ""}
      initialGroupId={group ?? ""}
    />
  );
}
