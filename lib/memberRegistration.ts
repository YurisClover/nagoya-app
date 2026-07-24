"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { addMemberToSheet, getCachedMembers } from "@/lib/sheets";
import { nowJST } from "./datetime";

export async function createMemberAction(prevState: any, formData: FormData) {
  const user_name = (formData.get("user_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();
  const role = formData.get("role") as string;
  const status = formData.get("status") as string;

  // 1. バリデーション
  if (!user_name || !email || !password) {
    return { error: "氏名、メールアドレス、パスワードは必須項目です。" };
  }

  if (password.length < 6) {
    return { error: "パスワードは6文字以上で入力してください。" };
  }

  // 2. メールアドレスの重複チェック
  const allMembers = await getCachedMembers();
  const exists = allMembers.some(
    (m) => m.email.toLowerCase() === email.toLowerCase() && !m.deleted_at
  );

  if (exists) {
    return { error: "このメールアドレスは既に登録されています。" };
  }

  // 3. bcryptでパスワードをハッシュ化（ソルトラウンド: 10）
  const password_hash = await bcrypt.hash(password, 10);

  // 4. サーバー側で自動採番 (例: M0001, M0002...)
  const nextIdNumber = allMembers.length + 1;
  const member_id = `M${String(nextIdNumber).padStart(4, "0")}`;

  // 5. スプレッドシートに1行追加
  const result = await addMemberToSheet({
    member_id,
    user_name,
    email,
    password_hash, // ハッシュ化したパスワードを渡す
    role: role || "general",
    status: status || "有効",
    created_at: nowJST(),
  });

  if (!result.success) {
    return { error: result.error };
  }

  // 6. 成功したら一覧画面へ遷移
  redirect("/admin/users");
}