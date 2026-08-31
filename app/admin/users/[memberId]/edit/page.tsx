/**
 * Edit member (/admin/users/<id>/edit). Loads the member from the
 * server cache, 404 when absent or soft-deleted, then binds member_id
 * into updateMemberAction - .bind() fixes the id server-side so the
 * client form cannot tamper with which row is edited.
 * Passes only whitelisted fields to the client form (never the hash).
 */
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/guards";
import { getCachedMembers } from "@/lib/sheets";
import { updateMemberAction } from "@/lib/memberRegistration";
import EditUserForm from "./EditUserForm";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ memberId: string }>; // key MUST same folder name [memberId]
}) {
  await requireAdmin();
  const { memberId } = await params;

  const members = await getCachedMembers();
  const member = members.find(
    (m) => String(m.member_id).trim() === memberId.trim() && !m.deleted_at,
  );
  if (!member) notFound();

  // bind member_id from server → client form no need to send id
  const action = updateMemberAction.bind(null, member.member_id);

  return (
    <EditUserForm
      action={action}
      member={{
        member_id: member.member_id,
        user_name: member.user_name,
        email: member.email,
        role: member.role,
        status: member.status,
      }}
    />
  );
}
