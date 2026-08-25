"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/guards";
import { STATUS_LABELS,USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from "@/types/user";
import { addMemberToSheet, updateMemberInSheet, getCachedMembers,logActivity } from "@/lib/sheets";
import { nowJST } from "./datetime";

const BCRYPT_COST = 12;
type FormState = { error: string } | null;

export async function createMemberAction(prevState: FormState, formData: FormData) {

  await requireAdmin();
  const user_name = (formData.get("user_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string; // space is password no Trim
  const rawRole = formData.get("role") as string;
  const rawStatus = formData.get("status") as string;

  // 1. バリデーション
  if (!user_name || !email || !password) {
    return { error: "氏名、メールアドレス、パスワードは必須項目です。" };
  }

  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください。" };
  }
  // whitelist from single source in types/user - client send weirdo value -> fallback default
  const role: UserRole = (USER_ROLES as readonly string[]).includes(rawRole)
    ? (rawRole as UserRole) : "general";
  const status: UserStatus = (USER_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as UserStatus) : "active";

  // 2. メールアドレスの重複チェック
  const allMembers = await getCachedMembers();
  const exists = allMembers.some(
    (m) => m.email.toLowerCase() === email.toLowerCase() && !m.deleted_at
  );
  if (exists) {
    return { error: "このメールアドレスは既に登録されています。" };
  }

  // 3. bcryptでパスワードをハッシュ化（ソルトラウンド: 12）
  const password_hash = await bcrypt.hash(password, BCRYPT_COST);

  // 4. サーバー側で自動採番 ( maxvalue + 1)
  const maxId = allMembers.reduce((max, m) => {
    const n = Number(String(m.member_id).trim());
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  const member_id = String(maxId > 0 ? maxId + 1 : 10000001);

  // 5. スプレッドシートに1行追加
  const now = nowJST();
  const result = await addMemberToSheet({
    member_id, user_name, email, password_hash, role, status,
    created_at: now, updated_at: now,
  });
  if (!result.success) {
  return { error: result.error ?? "登録に失敗しました。" };
   }
    await logActivity( "member", `${user_name} さんが新規登録されました`,);
    redirect("/admin/users");
}

export async function updateMemberAction(
    memberId: string,
    prevState: FormState,
    formData: FormData
) {
    await requireAdmin();

    const user_name = (formData.get("user_name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;
    const rawRole = formData.get("role") as string;
    const rawStatus = formData.get("status") as string;

    if (!memberId) return { error: "会員IDが不正です。" };
  if (!user_name || !email) {
    return { error: "氏名、メールアドレスは必須項目です。" };
  }
  if (password && password.length < 8) {
    return { error: "パスワードを変更する場合は8文字以上で入力してください。" };
  }
  const role: UserRole = (USER_ROLES as readonly string[]).includes(rawRole)
    ? (rawRole as UserRole) : "general";
  const status: UserStatus = (USER_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as UserStatus) : "active";

  const allMembers = await getCachedMembers();
  const currentMember = allMembers.find( (member) => String(member.member_id).trim() === memberId.trim(),);
  const exists = allMembers.some(
    (m) =>
      m.email.toLowerCase() === email.toLowerCase() &&
      !m.deleted_at &&
      String(m.member_id).trim() !== memberId.trim()
  );
  if (exists) {
    return { error: "このメールアドレスは既に別の会員に登録されています。" };
  }

  const result = await updateMemberInSheet(memberId, {
    user_name,
    email,
    role,
    status,
    updated_at: nowJST(),
    ...(password ? { password_hash: await bcrypt.hash(password, BCRYPT_COST) } : {}),
  });
  if (!result.success) {
  return { error: result.error ?? "更新に失敗しました。" };
}
const statusChanged = currentMember !== undefined && currentMember.status !== status;
await logActivity( "member", statusChanged  ? `${user_name} さんのステータスを${STATUS_LABELS[status]}に変更`: `${user_name} さんの会員情報を更新`,
);
redirect("/admin/users");
}