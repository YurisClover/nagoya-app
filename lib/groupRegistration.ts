"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/guards";
import {
  addGroupToSheet,
  deleteGroupFromSheet,
  getCachedGroupsWithMembers,
  logActivity,
  updateGroupInSheet,
} from "@/lib/sheets";
import { nowJST } from "@/lib/datetime";

type FormState = { error: string } | null;

/**
 * member_ids arrives as a JSON string from the client. Parse defensively:
 * malformed JSON or a non-string[] payload returns null instead of throwing,
 * so the action can show a form error rather than crash the request.
 */
function parseMemberIds(raw: unknown): string[] | null {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((id): id is string => typeof id === "string")) return null;
    return parsed;
  } catch {
    return null;
  }
}

// 新規グループ作成
export async function createGroupAction( prevState: FormState, formData: FormData,) {
  const session = await requireAdmin();
  const group_name = (formData.get("group_name") as string)?.trim();
  const member_ids = parseMemberIds(formData.get("member_ids"));
  if (member_ids === null) {
    return { error: "メンバーの選択内容が不正です。ページを再読み込みしてください。" };
  }
  if (!group_name) {
    return { error: "グループ名は必須です。" };
  }
  if (member_ids.length === 0) {
    return { error: "メンバーを1名以上選択してください。" };
  }

  const groups = await getCachedGroupsWithMembers();
  if ( groups.some( (group) => group.group_name.trim() === group_name, )  ) {
    return { error: "同じ名前のグループが既に存在します。" };
  }
  const result = await addGroupToSheet({
    group_name,
    member_ids,
    created_by: session.user?.id ?? "",
    created_at: nowJST(),
  });

  if (!result.success) {
    return { error: result.error ?? "作成に失敗しました。" };
  }
  await logActivity( "group", `グループ「${group_name}」を作成`, );
  redirect("/admin/groups");
}

// グループ更新
export async function updateGroupAction( prevState: FormState, formData: FormData,) {
  await requireAdmin();
  const group_id = (formData.get("group_id") as string)?.trim();
  const group_name = (formData.get("group_name") as string)?.trim();
  const member_ids = parseMemberIds(formData.get("member_ids"));
  if (member_ids === null) {
    return { error: "メンバーの選択内容が不正です。ページを再読み込みしてください。" };
  }
  if (!group_id) {
    return { error: "グループIDが不正です。" };
  }
  if (!group_name) {
    return { error: "グループ名は必須です。" };
  }
  if (member_ids.length === 0) {
    return { error: "メンバーを1名以上選択してください。" };
  }
  const groups = await getCachedGroupsWithMembers();
  const currentGroup = groups.find( (group) => String(group.group_id).trim() === group_id, );
  if (!currentGroup) {
    return { error: "対象のグループが見つかりませんでした。" };
  }
  if ( groups.some( (group) => group.group_name.trim() === group_name && String(group.group_id).trim() !== group_id, ) ) {
    return { error: "同じ名前のグループが既に存在します。" };
  }
  const previousMemberIds = new Set( currentGroup.members.map((member) => String(member.member_id).trim(), ), );
  const nextMemberIds = new Set( member_ids.map((memberId) => String(memberId).trim(),  ), );
  const groupNameChanged = currentGroup.group_name.trim() !== group_name;
  const memberAdded = [...nextMemberIds].some( (memberId) => !previousMemberIds.has(memberId), );
  const memberRemoved = [...previousMemberIds].some( (memberId) => !nextMemberIds.has(memberId), );
  const result = await updateGroupInSheet(group_id, { group_name, member_ids, updated_at: nowJST(), });
  if (!result.success) {
    return { error: result.error ?? "更新に失敗しました。" };
  }
  if (groupNameChanged) {
    await logActivity(  "group", `グループ「${group_name}」の情報を更新`,
    );
  }
  if (memberAdded) {
    await logActivity( "group", `グループ「${group_name}」にメンバー追加`, );
  }
  if (memberRemoved) { await logActivity( "group", `グループ「${group_name}」からメンバー削除`,  );}
  redirect("/admin/groups");
}

// グループ削除
export async function deleteGroupAction(group_id: string) {
  await requireAdmin();
  const normalizedGroupId = group_id.trim();
  if (!normalizedGroupId) {
    throw new Error("グループIDが不正です。");
  }
  const groups = await getCachedGroupsWithMembers();
  const targetGroup = groups.find( (group) => String(group.group_id).trim() === normalizedGroupId, );
  if (!targetGroup) {
    throw new Error("対象のグループが見つかりませんでした。");
  }
  const result = await deleteGroupFromSheet(normalizedGroupId);
  if (!result.success) {
    throw new Error(result.error ?? "削除に失敗しました。");
  }
  await logActivity( "group", `グループ「${targetGroup.group_name}」を削除`, );
  redirect("/admin/groups");
}