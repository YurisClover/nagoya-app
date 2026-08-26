/**
 * Admin member list (/admin/users). Server-rendered table on purpose:
 * filtering/sorting/paging run on the server via getPaginatedMembers,
 * driven entirely by URL searchParams (query/role/status/sort/page),
 * so the URL is shareable state. SearchFilters only rewrites the URL;
 * no member data crosses into client components here.
 */
import Link from "next/link";
import SearchFilters from "./SearchFilters";
import { getPaginatedMembers } from "@/lib/sheets";
import { ROLE_LABELS, STATUS_LABELS, type UserRole, type UserStatus } from "@/types/user";
import { formatDateJP } from "@/lib/datetime";
import { requireAdmin } from "@/lib/guards";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    query?: string;
    role?: string;
    status?: string;
    page?: string;
    sort?: string;
  }>;
}) {
  await requireAdmin();

  const resolvedParams = await searchParams;
  const query = resolvedParams.query || "";
  const role = resolvedParams.role || "all";
  const status = resolvedParams.status || "all";
  const page = Number(resolvedParams.page) || 1;
  const sort = resolvedParams.sort === "asc" ? "asc" : "desc";
  const limit = 10;

  // 実データ取得関数を呼び出し
  const { items, totalItems, totalPages, startIndex, endIndex } =
    await getPaginatedMembers({ query, role, status, page, limit, sort });

  return (
    <div className="space-y-6">
      {/* 1. ヘッダーエリア */}
      <div className="flex justify-between items-center border-b border-line pb-4">
        <h1 className="text-2xl font-bold">ユーザー管理</h1>
        <Link
          href="/admin/users/new"
          className="btn btn-primary"
        >
          ＋ 新規会員登録
        </Link>
      </div>
      
      <div className="card space-y-4">
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
                <th className="p-3 font-semibold whitespace-nowrap">
                    <Link
                        href={{
                        pathname: "/admin/users",
                        query: { ...resolvedParams, sort: sort === "desc" ? "asc" : "desc", page: 1 },
                        }}
                        className="inline-flex items-center gap-1 hover:text-brand"
                        title="会員IDで並び替え"
                    >
                        会員ID {sort === "desc" ? "▼" : "▲"}
                    </Link>
                </th>
                <th className="p-3 font-semibold">氏名</th>
                <th className="p-3 font-semibold">メールアドレス</th>
                <th className="w-24 whitespace-nowrap p-3 text-center font-semibold">権限</th>
                <th className="w-24 whitespace-nowrap p-3 text-center font-semibold">ステータス</th>
                <th className="w-28 whitespace-nowrap p-3 text-center font-semibold">登録日</th>
                <th className="w-16 whitespace-nowrap p-3 text-center font-semibold">操作</th>
                </tr>
            </thead>
            <tbody>
                {items.length > 0 ? (
                items.map((user) => (
                    <tr key={user.member_id} className="border-b hover:bg-surface-muted">
                    <td className="whitespace-nowrap p-3">{user.member_id}</td>
                    <td className="whitespace-nowrap p-3">{user.user_name}</td>
                    <td className="whitespace-nowrap p-3">{user.email}</td>
                    <td className="whitespace-nowrap p-3 text-center">{ROLE_LABELS[user.role as UserRole] ?? user.role}</td>
                    <td className="whitespace-nowrap p-3 text-center">
                        <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                            user.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                        >
                        {STATUS_LABELS[user.status as UserStatus] ?? user.status}
                        </span>
                    </td>
                    <td className="whitespace-nowrap p-3 text-center">{formatDateJP(user.created_at)}</td>
                    <td className="p-3 text-center">
                        <Link
                        href={`/admin/users/${user.member_id}/edit`}
                        className="text-brand hover:underline text-sm font-medium"
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
            <div className="text-ink-muted">
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
                className={`px-3 py-1 rounded-control border border-line ${
                page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-surface-muted"
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
                        className={`px-3 py-1 rounded-control border border-line ${
                        p === page
                            ? "bg-brand text-white border-brand font-bold"
                            : "hover:bg-surface-muted"
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
                className={`px-3 py-1 rounded-control border border-line ${
                page >= totalPages
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-surface-muted"
                }`}
            >
                次へ
            </Link>
            </div>
        </div>
      </div>
    </div>
  );
}