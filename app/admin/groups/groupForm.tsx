"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { Member } from "@/lib/sheets";
import { SheetUser } from "@/lib/sheets";

type Props = {
  initialData?: {
    group_id?: string;
    group_name: string;
    members: SheetUser[];
  };
  allUsers: Member[];
  action: (prevState: any, formData: FormData) => Promise<any>;
  isEdit?: boolean;
};

export default function GroupForm({ initialData, allUsers, action, isEdit = false }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [groupName, setGroupName] = useState(initialData?.group_name || "");
  const [selectedMembers, setSelectedMembers] = useState<SheetUser[]>(initialData?.members || []);
  const [searchQuery, setSearchQuery] = useState("");

  // 検索クエリで未選択ユーザーを絞り込み
  const filteredUsers = searchQuery.trim()
    ? allUsers.filter(
        (u) =>
          !selectedMembers.some((sm) => sm.member_id === u.member_id) &&
          (u.user_name.includes(searchQuery) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const handleAddMember = (user: SheetUser) => {
    setSelectedMembers([...selectedMembers, user]);
    setSearchQuery("");
  };

  const handleRemoveMember = (member_id: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.member_id !== member_id));
  };

  return (
    <form action={formAction} className="space-y-6 max-w-2xl mx-auto p-6 border rounded-lg bg-white shadow-sm">
      <h1 className="text-2xl font-bold border-b pb-3">
        {isEdit ? "グループ編集" : "新規グループ作成"}
      </h1>

      {state?.error && (
        <div className="p-3 bg-red-100 text-red-700 text-sm rounded border border-red-200">
          {state.error}
        </div>
      )}

      {isEdit && <input type="hidden" name="group_id" value={initialData?.group_id} />}
      <input type="hidden" name="member_ids" value={JSON.stringify(selectedMembers.map((m) => m.member_id))} />

      {/* グループ名 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          グループ名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="group_name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          required
          placeholder="例: 執行部チーム"
          className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* メンバー検索＆選択 */}
      <div>
        <label className="block text-sm font-medium mb-1">メンバー追加</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="名前またはメールアドレスで検索..."
          className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
        />

        {/* 検索結果サジェスト */}
        {filteredUsers.length > 0 && (
          <div className="border rounded max-h-40 overflow-y-auto bg-white shadow-lg mb-4 divide-y">
            {filteredUsers.map((u) => (
              <div
                key={u.member_id}
                onClick={() => handleAddMember(u)}
                className="p-2 text-sm hover:bg-blue-50 cursor-pointer flex justify-between items-center"
              >
                <span>{u.user_name} ({u.email})</span>
                <span className="text-xs text-blue-600 font-medium">追加</span>
              </div>
            ))}
          </div>
        )}

        {/* 選択中のメンバーバッジ表示 */}
        <div className="mt-3">
          <span className="text-xs text-gray-500 block mb-2">
            選択中メンバー ({selectedMembers.length} 名):
          </span>
          <div className="flex flex-wrap gap-2">
            {selectedMembers.map((m) => (
              <span
                key={m.member_id}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200"
              >
                {m.user_name}
                <button
                  type="button"
                  onClick={() => handleRemoveMember(m.member_id)}
                  className="hover:text-red-500 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ボタン操作 */}
      <div className="pt-4 flex gap-3 border-t">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "保存中..." : isEdit ? "更新する" : "作成する"}
        </button>
        <Link
          href="/admin/groups"
          className="px-5 py-2 border text-sm rounded font-medium hover:bg-gray-100 flex items-center"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}