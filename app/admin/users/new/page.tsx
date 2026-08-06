"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createMemberAction } from "@/lib/memberRegistration";

export default function NewUserPage() {
  const [state, formAction, isPending] = useActionState(createMemberAction, null);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center pb-4 border-b">
        <h1 className="text-2xl font-bold">新規会員登録</h1>
        <Link
          href="/admin/users"
          className="px-4 py-2 border rounded text-sm hover:bg-gray-100"
        >
          一覧に戻る
        </Link>
      </div>

      {/* エラーメッセージ表示 */}
      {state?.error && (
        <div className="p-3 bg-red-100 text-red-700 text-sm rounded border border-red-200">
          {state.error}
        </div>
      )}

      {/* 入力フォーム */}
      <form action={formAction} className="space-y-4">
        {/* 氏名 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            氏名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="user_name"
            required
            placeholder="山田 太郎"
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* メールアドレス */}
        <div>
          <label className="block text-sm font-medium mb-1">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            required
            placeholder="yamada@example.com"
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* パスワード（bcryptハッシュ化して登録） */}
        <div>
          <label className="block text-sm font-medium mb-1">
            初期パスワード <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder="8文字以上で入力"
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* 役職 */}
        <div>
          <label className="block text-sm font-medium mb-1">役職</label>
          <select
            name="role"
            defaultValue="general"
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none bg-white"
          >
            <option value="general">一般会員 (general)</option>
            <option value="executive">執行部 (executive)</option>
            <option value="admin">管理者 (admin)</option>
          </select>
        </div>

        {/* ステータス */}
        <div>
          <label className="block text-sm font-medium mb-1">ステータス</label>
          <select
            name="status"
            defaultValue="active"
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none bg-white"
          >
            <option value="active">有効</option>
            <option value="inactive">無効</option>
          </select>
        </div>

        {/* ボタン操作 */}
        <div className="pt-4 flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "登録中..." : "登録する"}
          </button>
          <Link
            href="/admin/users"
            className="px-5 py-2 border text-sm rounded font-medium hover:bg-gray-100 flex items-center"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}