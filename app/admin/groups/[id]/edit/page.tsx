import { notFound } from "next/navigation";
import { getCachedMembers, getGroupById } from "@/lib/sheets";
import { updateGroupAction } from "@/lib/groupRegistration";
import GroupForm from "../../groupForm";
import { requireAdmin } from "@/lib/guards";

// Next.js 15 では params は Promise になります
export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  // ★ params を await して id を取り出す
  const { id } = await params;

  const [group, allUsers] = await Promise.all([
    getGroupById(id),
    getCachedMembers(),
  ]);

  if (!group) {
    notFound(); // グループが見つからない場合に404になります
  }

  return (
    <div>
      <GroupForm
        initialData={group}
        allUsers={allUsers}
        action={updateGroupAction}
        isEdit
      />
    </div>
  );
}