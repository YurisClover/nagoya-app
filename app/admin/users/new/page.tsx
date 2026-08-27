/**
 * New member form (/admin/users/new). useActionState around the
 * createMemberAction server action; validation, id numbering and the
 * activity log all live in lib/memberRegistration.ts. The action
 * redirects back to /admin/users on success.
 */
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createMemberAction } from "@/lib/memberRegistration";

export default function NewUserPage() {
  const [state, formAction, isPending] = useActionState(createMemberAction, null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h1 className="text-2xl font-bold">新規会員登録</h1>
        <Link href="/admin/users" className="btn btn-secondary px-4 py-2 text-sm">
          一覧に戻る
        </Link>
      </div>

      {state?.error && <div className="field-error card border-danger p-3">{state.error}</div>}

      <form action={formAction} className="card space-y-4 p-5 sm:p-6">
        <div>
          <label className="field-label">
            氏名 <span className="text-danger">*</span>
          </label>
          <input type="text" name="user_name" required placeholder="山田 太郎" className="field-input" />
        </div>

        <div>
          <label className="field-label">
            メールアドレス <span className="text-danger">*</span>
          </label>
          <input type="email" name="email" required placeholder="yamada@example.com" className="field-input" />
        </div>

        <div>
          <label className="field-label">
            初期パスワード <span className="text-danger">*</span>
          </label>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder="8文字以上で入力"
            className="field-input"
          />
        </div>

        <div>
          <label className="field-label">権限</label>
          <select name="role" defaultValue="general" className="field-input bg-surface">
            <option value="general">一般会員 (general)</option>
            <option value="executive">執行部 (executive)</option>
            <option value="admin">管理者 (admin)</option>
          </select>
        </div>

        <div>
          <label className="field-label">ステータス</label>
          <select name="status" defaultValue="active" className="field-input bg-surface">
            <option value="active">有効</option>
            <option value="inactive">無効</option>
          </select>
        </div>

        <div className="flex gap-3 border-t border-line pt-4">
          <button type="submit" disabled={isPending} className="btn btn-primary">
            {isPending ? "登録中..." : "登録する"}
          </button>
          <Link href="/admin/users" className="btn btn-secondary">
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}