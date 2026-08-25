import { getCachedMembers } from "@/lib/sheets";
import { createGroupAction } from "@/lib/groupRegistration";
import GroupForm from "../groupForm";
import { requireAdmin } from "@/lib/guards";

export default async function NewGroupPage() {
  await requireAdmin();
  const allUsers = await getCachedMembers();

  return (
    <div>
      <GroupForm allUsers={allUsers} action={createGroupAction} />
    </div>
  );
}