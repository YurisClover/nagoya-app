import { getCachedMembers } from "@/lib/sheets";
import { createGroupAction } from "@/lib/groupRegistration";
import GroupForm from "../groupForm";

export default async function NewGroupPage() {
  const allUsers = await getCachedMembers();

  return (
    <div className="p-6">
      <GroupForm allUsers={allUsers} action={createGroupAction} />
    </div>
  );
}