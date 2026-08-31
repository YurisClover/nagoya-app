/**
 * Members domain: the Users sheet. Login lookup (getUserByEmail), the
 * cached member list, pagination for the admin table, and member
 * create/update. Member deliberately omits password_hash - this list
 * flows into client components.
 */
import "server-only";
import type { GoogleSpreadsheetRow } from "google-spreadsheet";
import { unstable_cache, updateTag } from "next/cache";
import { sameId } from "@/lib/ids";
import { getUsersSheet } from "./core";

export type SheetUser = {
  member_id: string;
  user_name: string;
  password_hash: string;
  email: string;
  role: string;
  status: string;
};

function findRowByEmail(rows: GoogleSpreadsheetRow[], email: string) {
  const target = email.trim().toLowerCase();
  return rows.find(
    (r) =>
      String(r.get("email") ?? "")
        .trim()
        .toLowerCase() === target,
  );
}

export function rowToUser(row: GoogleSpreadsheetRow): SheetUser {
  return {
    member_id: String(row.get("member_id") ?? ""),
    user_name: String(row.get("user_name") ?? ""),
    password_hash: String(row.get("password_hash") ?? ""),
    email: String(row.get("email") ?? ""),
    role: String(row.get("role") ?? ""),
    status: String(row.get("status") ?? ""),
  };
}

export async function getUserByEmail(email: string): Promise<SheetUser | null> {
  const sheet = await getUsersSheet();
  const row = findRowByEmail(await sheet.getRows(), email);
  if (!row || row.get("deleted_at")) return null;
  return rowToUser(row);
}

export type Member = Omit<SheetUser, "password_hash"> & {
  created_at?: string;
  deleted_at?: string | null;
};

// 2. 【全会員データを取得する内部関数】
// 既存の getUsersSheet() を活用してシートを取得
async function fetchAllMembersFromSheet(): Promise<Member[]> {
  try {
    const sheet = await getUsersSheet();
    const rows = await sheet.getRows();

    return rows.map((row) => ({
      member_id: String(row.get("member_id") ?? ""),
      user_name: String(row.get("user_name") ?? ""),
      // SECURITY: never map password_hash here. This list flows into client
      // components (e.g. GroupForm), so any extra field ends up in the
      // browser payload even if the Member type hides it.
      email: String(row.get("email") ?? ""),
      role: String(row.get("role") ?? "general"),
      status: String(row.get("status") ?? "active"),
      created_at: String(row.get("created_at") ?? ""),
      deleted_at: row.get("deleted_at") ? String(row.get("deleted_at")) : null,
    }));
  } catch (error) {
    console.error("Failed to fetch members from sheet:", error);
    return [];
  }
}

// 3. 【キャッシュ付き会員一覧取得】
// 60秒間はGoogle APIを叩かずキャッシュを返す
export const getCachedMembers = unstable_cache(
  async () => {
    return await fetchAllMembersFromSheet();
  },
  ["members-list-cache"],
  {
    revalidate: 60,
    tags: ["members"], // 新規登録や更新時に revalidateTag("members") で即時キャッシュ破棄が可能
  },
);

// 4. 【サーバー側での検索・絞り込み・ページネーション処理】
export async function getPaginatedMembers(params: {
  query: string;
  role: string;
  status: string;
  page: number;
  limit: number;
  sort?: "asc" | "desc";
}) {
  const allMembers = await getCachedMembers();
  // 物理削除 (deleted_at に値が入っているもの) を自動除外
  const activeMembers = allMembers.filter((m) => !m.deleted_at);

  // 検索窓・フィルター絞り込み
  const filtered = activeMembers.filter((m) => {
    const q = params.query.toLowerCase();
    const matchesSearch =
      !params.query ||
      m.user_name.toLowerCase().includes(q) ||
      m.member_id.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q);

    const matchesRole = params.role === "all" || m.role === params.role;
    const matchesStatus = params.status === "all" || m.status === params.status;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // sort
  const dir = params.sort === "asc" ? 1 : -1;
  const idNum = (m: { member_id: string }) => {
    const n = Number(String(m.member_id).trim());
    return Number.isFinite(n) ? n : -Infinity;
  };
  filtered.sort((a, b) => (idNum(a) - idNum(b)) * dir);

  // 10件分切り出しとページネーション計算
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / params.limit) || 1;
  const startIndex = (params.page - 1) * params.limit;
  const endIndex = Math.min(startIndex + params.limit, totalItems);
  const items = filtered.slice(startIndex, endIndex);

  return {
    items,
    totalItems,
    totalPages,
    startIndex: totalItems > 0 ? startIndex + 1 : 0,
    endIndex,
  };
}

// ----------------------------------------------------
// 新規会員の追加処理
// ----------------------------------------------------
export async function addMemberToSheet(newMember: {
  member_id: string;
  user_name: string;
  email: string;
  password_hash: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}) {
  try {
    const sheet = await getUsersSheet();

    // スプレッドシートの末尾に1行追加
    await sheet.addRow(
      {
        member_id: newMember.member_id,
        user_name: newMember.user_name,
        password_hash: newMember.password_hash, // ハッシュ化された文字列を書き込む
        email: newMember.email,
        role: newMember.role,
        status: newMember.status,
        created_at: newMember.created_at,
        updated_at: newMember.updated_at,
        deleted_at: "",
      },
      { raw: true },
    ); // id must be raw (string)

    // キャッシュを破棄して即時反映
    updateTag("members");

    return { success: true };
  } catch (error) {
    console.error("Failed to add member to sheet:", error);
    return { success: false, error: "スプレッドシートの更新に失敗しました。" };
  }
}

// Edit user
export async function updateMemberInSheet(
  memberId: string,
  fields: {
    user_name: string;
    email: string;
    role: string;
    status: string;
    updated_at: string;
    password_hash?: string;
  },
) {
  try {
    const sheet = await getUsersSheet();
    const rows = await sheet.getRows();
    const target = memberId.trim();
    const row = rows.find((r) => sameId(r.get("member_id"), target));
    if (!row) {
      return { success: false, error: "対象の会員が見つかりませんでした。" };
    }

    row.set("user_name", fields.user_name);
    row.set("email", fields.email);
    row.set("role", fields.role);
    row.set("status", fields.status);
    row.set("updated_at", fields.updated_at);
    if (fields.password_hash) row.set("password_hash", fields.password_hash);
    await row.save({ raw: true }); //raw

    updateTag("members");
    return { success: true };
  } catch (error) {
    console.error("Failed to update member in sheet:", error);
    return { success: false, error: "スプレッドシートの更新に失敗しました。" };
  }
}

// ====================================================
// グループ管理関連の最適化版コード
// ====================================================
