"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth"; // ★ AdminLayoutと同じ書き方でインポート！
import { addGroupToSheet, updateGroupInSheet, deleteGroupFromSheet } from "@/lib/sheets";
import { nowJST } from "@/lib/datetime";

// 新規グループ作成
export async function createGroupAction(prevState: any, formData: FormData) {
  const group_name = (formData.get("group_name") as string)?.trim();
  const member_ids_raw = formData.get("member_ids") as string;
  const member_ids = member_ids_raw ? JSON.parse(member_ids_raw) : [];

  if (!group_name) {
    return { error: "グループ名は必須です。" };
  }
  if (member_ids.length === 0) {
    return { error: "メンバーを1名以上選択してください。" };
  }

  // ★ session からログイン中の会員番号を取得
  const session = await auth();
  const created_by =
    (session?.user as any)?.member_id ||
    (session?.user as any)?.id ||
    "UNKNOWN";

  const result = await addGroupToSheet({
    group_name,
    member_ids,
    created_by,
    created_at: nowJST(),
  });

  if (!result.success) {
    return { error: result.error };
  }

  redirect("/admin/groups");
}

// グループ更新
export async function updateGroupAction(prevState: any, formData: FormData) {
  const group_id = formData.get("group_id") as string;
  const group_name = (formData.get("group_name") as string)?.trim();
  const member_ids_raw = formData.get("member_ids") as string;
  const member_ids = member_ids_raw ? JSON.parse(member_ids_raw) : [];

  if (!group_name) {
    return { error: "グループ名は必須です。" };
  }
  if (member_ids.length === 0) {
    return { error: "メンバーを1名以上選択してください。" };
  }

  const result = await updateGroupInSheet(group_id, {
    group_name,
    member_ids,
    updated_at: nowJST(),
  });

  if (!result.success) {
    return { error: result.error };
  }

  redirect("/admin/groups");
}

// グループ削除
export async function deleteGroupAction(group_id: string) {
  const result = await deleteGroupFromSheet(group_id);
  if (!result.success) {
    throw new Error(result.error);
  }
  redirect("/admin/groups");
}