/**
 * Client form for editing whitelisted member fields (name/email/role/
 * status). Receives the already-bound server action; shows FormState
 * errors inline. member_id renders read-only for display only - the
 * server ignores any posted id.
 */
"use client";

import Link from "next/link";
import { useActionState } from "react";

type MemberFields = {
  member_id: string;
  user_name: string;
  email: string;
  role: string;
  status: string;
};

type FormState = { error: string } | null;

export default function EditUserForm({
  action,
  member,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  member: MemberFields;
}) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex justify-between items-center pb-4 border-b">
        <h1 className="text-2xl font-bold">会員情報の編集</h1>
        <Link href="/admin/users" className="px-4 py-2 border rounded text-sm hover:bg-gray-100">
          一覧に戻る
        </Link>
      </div>

      {state?.error && (
        <div className="p-3 bg-red-100 text-red-700 text-sm rounded border border-red-200">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">会員ID</label>
          <input
            type="text"
            value={member.member_id}
            disabled
            className="w-full px-3 py-2 border rounded text-sm bg-gray-100 text-gray-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            氏名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="user_name"
            required
            defaultValue={member.user_name}
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            required
            defaultValue={member.email}
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* password === null -> no change */}
        <div>
          <label className="block text-sm font-medium mb-1">新しいパスワード</label>
          <input
            type="password"
            name="password"
            minLength={8}
            placeholder="変更する場合のみ入力（8文字以上）"
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">役職</label>
          <select
            name="role"
            defaultValue={member.role}
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none bg-white"
          >
            <option value="general">一般会員 (general)</option>
            <option value="executive">執行部 (executive)</option>
            <option value="admin">管理者 (admin)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">ステータス</label>
          <select
            name="status"
            defaultValue={member.status}
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none bg-white"
          >
            <option value="active">有効</option>
            <option value="inactive">無効</option>
          </select>
        </div>

        <div className="pt-4 flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary"
          >
            {isPending ? "更新中..." : "更新する"}
          </button>
          <Link
            href="/admin/users"
            className="btn btn-secondary"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}