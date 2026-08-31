/**
 * Groups domain: Groups + GroupMembers sheets. The list is sorted by
 * group name (ja collation) at the source so every consumer agrees.
 * updateGroupInSheet replaces memberships delete-then-add (no rollback
 * on partial failure - known trade-off).
 */
import "server-only";
import { unstable_cache, updateTag } from "next/cache";
import { randomUUID } from "node:crypto";
import { sameId } from "@/lib/ids";
import { getGoogleDoc } from "./core";
import { rowToUser, type SheetUser } from "./members";

export type Group = {
  group_id: string;
  group_name: string;
  created_by: string;
  created_at: string;
};

export type GroupWithMembers = Group & {
  members: SheetUser[];
};

// 共通ドキュメント取得関数（doc.loadInfo() を1回だけ行う）
export async function getGroupsWithMembers(): Promise<GroupWithMembers[]> {
  const doc = await getGoogleDoc();
  const groupsSheet = doc.sheetsByTitle["Groups"];
  const groupMembersSheet = doc.sheetsByTitle["GroupMembers"];
  const usersSheet = doc.sheetsByTitle["Users"];

  if (!groupsSheet || !groupMembersSheet || !usersSheet) {
    throw new Error("必要なシートが見つかりません");
  }

  // 3つのシートの行データを並列取得
  const [groupRows, memberRows, userRows] = await Promise.all([
    groupsSheet.getRows(),
    groupMembersSheet.getRows(),
    usersSheet.getRows(),
  ]);

  const userMap = new Map<string, SheetUser>();
  userRows.forEach((row) => {
    if (!row.get("deleted_at")) {
      userMap.set(String(row.get("member_id")), rowToUser(row));
    }
  });

  const groupMembersMap = new Map<string, string[]>();
  memberRows.forEach((row) => {
    const gId = String(row.get("group_id"));
    const mId = String(row.get("member_id"));
    if (!groupMembersMap.has(gId)) {
      groupMembersMap.set(gId, []);
    }
    groupMembersMap.get(gId)!.push(mId);
  });

  const groups = groupRows.map((row) => {
    const group_id = String(row.get("group_id"));
    const memberIds = groupMembersMap.get(group_id) || [];
    const members = memberIds
      .map((id) => userMap.get(id))
      .filter((u): u is SheetUser => u !== undefined);

    return {
      group_id,
      group_name: String(row.get("group_name") ?? ""),
      created_by: String(row.get("created_by") ?? ""),
      created_at: String(row.get("created_at") ?? ""),
      members,
    };
  });

  // Display order: by group name, Japanese collation. numeric:true gives
  // natural ordering (グループ2 before グループ10). Note: kanji sort by
  // locale rules, not by reading — proper 読み order would need furigana
  // data we don't store.
  return groups.sort((a, b) =>
    a.group_name.localeCompare(b.group_name, "ja", { numeric: true }),
  );
}

// キャッシュ版の関数（画面表示はこちらを使う）
export const getCachedGroupsWithMembers = unstable_cache(
  async () => getGroupsWithMembers(),
  ["groups-with-members-list"],
  {
    tags: ["groups"],
    revalidate: 60,
  },
);

// 2. 単一グループの取得
export async function getGroupById(
  group_id: string,
): Promise<GroupWithMembers | null> {
  const all = await getCachedGroupsWithMembers();
  return all.find((g) => g.group_id === group_id) || null;
}

// 3. 新規グループ追加（一括追加で高速化）
export async function addGroupToSheet(data: {
  group_name: string;
  member_ids: string[];
  created_by: string;
  created_at: string;
}) {
  try {
    const doc = await getGoogleDoc();
    const groupsSheet = doc.sheetsByTitle["Groups"];
    const groupMembersSheet = doc.sheetsByTitle["GroupMembers"];

    // Unified id scheme: every entity id is a bare UUID (matches the
    // event_id spec). This also drops the full-sheet read that max+1
    // needed, and with it the duplicate-id race on concurrent creates.
    // Legacy numeric ids coexist safely; all comparisons are string-based.
    const groupId = randomUUID();

    await groupsSheet.addRow(
      {
        group_id: groupId,
        group_name: data.group_name,
        created_by: data.created_by,
        created_at: data.created_at,
      },
      { raw: true },
    );

    if (data.member_ids.length > 0) {
      const newMemberRows = data.member_ids.map((member_id) => ({
        group_id: groupId,
        member_id,
        created_at: data.created_at,
      }));
      await groupMembersSheet.addRows(newMemberRows, { raw: true });
    }

    updateTag("groups");
    return { success: true };
  } catch (error) {
    console.error("Failed to add group:", error);
    return { success: false, error: "グループの作成に失敗しました。" };
  }
}

// delete row bottom up ↑
async function deleteRowsBottomUp(
  rows: { rowNumber: number; delete: () => Promise<void> }[],
) {
  const sorted = [...rows].sort((a, b) => b.rowNumber - a.rowNumber);
  for (const row of sorted) {
    await row.delete();
  }
}

// 4. グループ更新（一括削除＆一括追加で高速化）
export async function updateGroupInSheet(
  group_id: string,
  data: { group_name: string; member_ids: string[]; updated_at: string },
) {
  try {
    const doc = await getGoogleDoc();
    const groupsSheet = doc.sheetsByTitle["Groups"];
    const groupMembersSheet = doc.sheetsByTitle["GroupMembers"];

    const groupRows = await groupsSheet.getRows();
    const targetGroup = groupRows.find((r) =>
      sameId(r.get("group_id"), group_id),
    );
    if (!targetGroup) {
      return {
        success: false,
        error: "対象のグループが見つかりませんでした。",
      };
    }
    targetGroup.set("group_name", data.group_name);
    await targetGroup.save({ raw: true });

    // 旧メンバーの削除 bottom up ↑
    const memberRows = await groupMembersSheet.getRows();
    const oldRows = memberRows.filter((r) =>
      sameId(r.get("group_id"), group_id),
    );
    await deleteRowsBottomUp(oldRows);

    // ★ addRows で新メンバーを一括追加
    if (data.member_ids.length > 0) {
      const newMemberRows = data.member_ids.map((member_id) => ({
        group_id,
        member_id,
        created_at: data.updated_at,
      }));
      await groupMembersSheet.addRows(newMemberRows, { raw: true });
    }

    updateTag("groups");
    return { success: true };
  } catch (error) {
    console.error("Failed to update group:", error);
    return { success: false, error: "グループの更新に失敗しました。" };
  }
}

// 5. グループ物理削除
export async function deleteGroupFromSheet(group_id: string) {
  try {
    const doc = await getGoogleDoc();
    const groupsSheet = doc.sheetsByTitle["Groups"];
    const groupMembersSheet = doc.sheetsByTitle["GroupMembers"];

    const groupRows = await groupsSheet.getRows();
    const targetGroup = groupRows.find((r) =>
      sameId(r.get("group_id"), group_id),
    );
    if (targetGroup) await targetGroup.delete();

    const memberRows = await groupMembersSheet.getRows();
    const targetMembers = memberRows.filter((r) =>
      sameId(r.get("group_id"), group_id),
    );
    await deleteRowsBottomUp(targetMembers);

    updateTag("groups");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete group:", error);
    return { success: false, error: "グループの削除に失敗しました。" };
  }
}
