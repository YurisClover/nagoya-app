import Link from "next/link";
import SearchFilters from "./SearchFilters";
import { getPaginatedMembers } from "@/lib/sheets"; 

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    query?: string;
    role?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.query || "";
  const role = resolvedParams.role || "all";
  const status = resolvedParams.status || "all";
  const page = Number(resolvedParams.page) || 1;
  const limit = 10;

  // 実データ取得関数を呼び出し
  const { items, totalItems, totalPages, startIndex, endIndex } =
    await getPaginatedMembers({ query, role, status, page, limit });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. ヘッダーエリア */}
      <div className="flex justify-between items-center pb-4 border-b">
        <h1 className="text-2xl font-bold">ユーザー管理</h1>
        <Link
          href="/admin/users/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
        >
          新規会員を登録
        </Link>
      </div>

      {/* 2. 検索 & フィルターエリア */}
      <SearchFilters
        initialQuery={query}
        initialRole={role}
        initialStatus={status}
      />

      {/* 3. 会員一覧テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-3 font-semibold">会員番号</th>
              <th className="p-3 font-semibold">氏名</th>
              <th className="p-3 font-semibold">メールアドレス</th>
              <th className="p-3 font-semibold">役職</th>
              <th className="p-3 font-semibold">ステータス</th>
              <th className="p-3 font-semibold">登録日</th>
              <th className="p-3 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((user) => (
                <tr key={user.member_id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{user.member_id}</td>
                  <td className="p-3">{user.user_name}</td>
                  <td className="p-3">{user.email}</td>
                  <td className="p-3">{user.role}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        user.status === "有効"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="p-3">{user.created_at}</td>
                  <td className="p-3">
                    <Link
                      href={`/admin/users/${user.member_id}/edit`}
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      編集
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  該当する会員が見つかりませんでした。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. ページネーションエリア */}
      <div className="flex justify-between items-center pt-2 text-sm">
        <div className="text-gray-600">
          {totalItems > 0
            ? `${totalItems}名中 ${startIndex}～${endIndex}件を表示`
            : "0名中 0件を表示"}
        </div>

        <div className="flex items-center gap-2">
          {/* 前へボタン */}
          <Link
            href={{
              pathname: "/admin/users",
              query: { ...resolvedParams, page: Math.max(1, page - 1) },
            }}
            className={`px-3 py-1 border rounded ${
              page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-100"
            }`}
          >
            前へ
          </Link>

          {/* 数字ページボタン（省略表示つき） */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .map((p, index, array) => {
              const showEllipsis = index > 0 && p - array[index - 1] > 1;

              return (
                <div key={p} className="flex items-center gap-1">
                  {showEllipsis && <span className="px-1 text-gray-400">...</span>}
                  <Link
                    href={{
                      pathname: "/admin/users",
                      query: { ...resolvedParams, page: p },
                    }}
                    className={`px-3 py-1 border rounded ${
                      p === page
                        ? "bg-blue-600 text-white border-blue-600 font-bold"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </Link>
                </div>
              );
            })}

          {/* 次へボタン */}
          <Link
            href={{
              pathname: "/admin/users",
              query: { ...resolvedParams, page: Math.min(totalPages, page + 1) },
            }}
            className={`px-3 py-1 border rounded ${
              page >= totalPages
                ? "pointer-events-none opacity-40"
                : "hover:bg-gray-100"
            }`}
          >
            次へ
          </Link>
        </div>
      </div>
    </div>
  );
}