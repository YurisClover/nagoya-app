import Link from "next/link";
import { getCachedGroupsWithMembers } from "@/lib/sheets";
import { requireAdmin } from "@/lib/guards";
import { deleteGroupAction } from "@/lib/groupRegistration";
import DeleteGroupButton from "./DeleteGroupButton";

export default async function GroupsPage() {
  await requireAdmin();
  const groups = await getCachedGroupsWithMembers();

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">グループ管理</h1>
        <Link
          href="/admin/groups/new"
          className="btn btn-primary"
        >
          ＋ グループを作成
        </Link>
      </div>

      {/* グループグリッド（2列表示） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.map((group) => {
          const displayMembers = group.members.slice(0, 3);
          const remainingCount = group.members.length - 3;

          return (
            <div
              key={group.group_id}
              className="border rounded-lg p-5 bg-white shadow-sm flex flex-col justify-between space-y-4"
            >
              <div>
                {/* タイトルと人数 */}
                <div className="flex justify-between items-baseline border-b pb-2 mb-3">
                  <h2 className="text-lg font-bold text-gray-800">{group.group_name}</h2>
                  <span className="text-sm text-gray-500 font-medium">
                    {group.members.length} 名
                  </span>
                </div>

                {/* メンバー表示（3名まで ＋ 余剰人数） */}
                <div className="space-y-1">
                  {displayMembers.map((m) => (
                    <div key={m.member_id} className="text-sm text-gray-700">
                      • {m.user_name}
                    </div>
                  ))}
                  {remainingCount > 0 && (
                    <div className="text-sm text-gray-400 pl-3 pt-1 font-medium">
                      ＋ {remainingCount} 名
                    </div>
                  )}
                </div>
              </div>

              {/* 下部アクションボタン */}
              <div className="flex justify-between items-center pt-3 border-t">
                <Link
                  href={`/admin/groups/${group.group_id}/edit`}
                  className="btn btn-secondary px-3 py-1.5 text-xs"
                >
                  編集
                </Link>
                <DeleteGroupButton
                  action={deleteGroupAction.bind(null, group.group_id)}
                  groupName={group.group_name}
                />
                <button
                  type="button"
                  disabled
                  className="btn btn-secondary px-4 py-1.5 text-xs"
                >
                  送信
                </button>
              </div>
            </div>
          );
        })}

        {/* 余白部分の「グループを追加」カード枠 */}
        <Link
          href="/admin/groups/new"
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-colors min-h-[180px]"
        >
          <span className="text-2xl mb-1">＋</span>
          <span className="text-sm font-medium">グループを追加</span>
        </Link>
      </div>
    </div>
  );
}