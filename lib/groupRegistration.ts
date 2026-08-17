"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/guards";
import {
    addGroupToSheet,
    updateGroupInSheet,
    deleteGroupFromSheet,
    getCachedGroupsWithMembers,
} from "@/lib/sheets";
import { nowJST } from "@/lib/datetime";

type FormState = { error: string } | null;

// 新規グループ作成
export async function createGroupAction(prevState: FormState, formData: FormData) {
  const session = await requireAdmin(); // do auth first then 1,2,3..

  const group_name = (formData.get("group_name") as string)?.trim();
  const member_ids_raw = formData.get("member_ids") as string;
  const member_ids: string[] = member_ids_raw ? JSON.parse(member_ids_raw) : [];

  if (!group_name) return { error: "グループ名は必須です。" };
  if (member_ids.length === 0) return { error: "メンバーを1名以上選択してください。" };

  // check name isExist ?
  const groups = await getCachedGroupsWithMembers();
  if (groups.some((g) => g.group_name.trim() === group_name)) {
    return { error: "同じ名前のグループが既に存在します。" };
  }

  const result = await addGroupToSheet({
    group_name,
    member_ids,
    created_by: session.user?.id ?? "", // only from session
    created_at: nowJST(),
  });
  if (!result.success) return { error: result.error ?? "作成に失敗しました。" };

  redirect("/admin/groups");
}

// グループ更新
export async function updateGroupAction(prevState: FormState, formData: FormData) {
  await requireAdmin();

  const group_id = (formData.get("group_id") as string)?.trim();
  const group_name = (formData.get("group_name") as string)?.trim();
  const member_ids_raw = formData.get("member_ids") as string;
  const member_ids: string[] = member_ids_raw ? JSON.parse(member_ids_raw) : [];

  if (!group_id) return { error: "グループIDが不正です。" };
  if (!group_name) return { error: "グループ名は必須です。" };
  if (member_ids.length === 0) return { error: "メンバーを1名以上選択してください。" };
  
  // check name isExist ?
  const groups = await getCachedGroupsWithMembers();
  if (groups.some((g) => g.group_name.trim() === group_name && g.group_id !== group_id)) {
    return { error: "同じ名前のグループが既に存在します。" };
  }
  
  const result = await updateGroupInSheet(group_id, {
    group_name,
    member_ids,
    updated_at: nowJST(),
  });
  if (!result.success) return { error: result.error ?? "更新に失敗しました。" };

  redirect("/admin/groups");
}

// グループ削除
export async function deleteGroupAction(group_id: string) {
  await requireAdmin();

  const result = await deleteGroupFromSheet(group_id);
  if (!result.success) {
    throw new Error(result.error ?? "削除に失敗しました。");
  }
  redirect("/admin/groups");
}