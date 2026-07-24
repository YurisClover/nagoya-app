// "use client";

// import { useRouter, usePathname, useSearchParams } from "next/navigation";
// import { useState, useEffect } from "react";

// export default function SearchFilters({
//   initialQuery,
//   initialRole,
//   initialStatus,
// }: {
//   initialQuery: string;
//   initialRole: string;
//   initialStatus: string;
// }) {
//   const router = useRouter();
//   const pathname = usePathname();
//   const searchParams = useSearchParams();

//   const [searchTerm, setSearchTerm] = useState(initialQuery);

//   // URLパラメータを更新する共通関数
//   const updateParams = (key: string, value: string) => {
//     const params = new URLSearchParams(searchParams.toString());
//     if (value && value !== "all") {
//       params.set(key, value);
//     } else {
//       params.delete(key);
//     }
//     // 検索・フィルター変更時は 1 ページ目に戻す
//     if (key !== "page") {
//       params.set("page", "1");
//     }
//     router.replace(`${pathname}?${params.toString()}`);
//   };

//   // テキスト入力のデバウンス処理（300ms後にURL更新）
//   useEffect(() => {
//     // 初期値と同じ場合は何もしない（初回レンダリング時の不要な発火防止）
//     if (searchTerm === (searchParams.get("query") || "")) return;

//     const timer = setTimeout(() => {
//       updateParams("query", searchTerm);
//     }, 300);

//     return () => clearTimeout(timer);
//   }, [searchTerm]);

//   return (
//     <div className="flex flex-wrap gap-4 items-center">
//       {/* 検索窓（Enterキーで即時反映、または300ms入力停止で自動反映） */}
//       <div className="flex gap-2 flex-1 min-w-[280px]">
//         <input
//           type="text"
//           placeholder="氏名・会員番号・メールアドレスで検索"
//           value={searchTerm}
//           onChange={(e) => setSearchTerm(e.target.value)}
//           onKeyDown={(e) => {
//             if (e.key === "Enter") {
//               updateParams("query", searchTerm);
//             }
//           }}
//           className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
//         />
//       </div>

//       {/* 役職フィルター（選択時に即時反映） */}
//       <select
//         value={initialRole}
//         onChange={(e) => updateParams("role", e.target.value)}
//         className="px-3 py-2 border rounded text-sm focus:outline-none"
//       >
//         <option value="all">全ての役職</option>
//         <option value="一般会員">一般会員</option>
//         <option value="執行部">執行部</option>
//         <option value="管理者">管理者</option>
//       </select>

//       {/* ステータスフィルター（選択時に即時反映） */}
//       <select
//         value={initialStatus}
//         onChange={(e) => updateParams("status", e.target.value)}
//         className="px-3 py-2 border rounded text-sm focus:outline-none"
//       >
//         <option value="all">すべてのステータス</option>
//         <option value="有効">有効</option>
//         <option value="無効">無効</option>
//       </select>
//     </div>
//   );
// }

// // export default function UserSearch() {
 
// //   return (
// //     <div>
// //         <p>ユーザー管理</p>
// //         <div>新規会員を登録</div>
// //         <div>検索欄</div>
// //         <div>全ての役職</div>
// //         <div>すべてのステータス</div>
// //         <div>会員一覧</div>


// //     </div>

// //   )}
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useTransition } from "react";

export default function SearchFilters({
  initialQuery,
  initialRole,
  initialStatus,
}: {
  initialQuery: string;
  initialRole: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(initialQuery);

  // URLが変わったら（ブラウザの戻るボタンなど）入力欄も同期させる
  useEffect(() => {
    setSearchTerm(initialQuery);
  }, [initialQuery]);

  // URLパラメータを更新する関数
  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    // 検索条件変更時は1ページ目に戻す
    if (key !== "page") {
      params.set("page", "1");
    }

    // startTransition で包むと、画面更新中の挙動がスムーズになります
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  // デバウンス処理
  useEffect(() => {
    // 現在のURLパラメータと同じなら何もしない
    const currentQueryInUrl = searchParams.get("query") || "";
    if (searchTerm === currentQueryInUrl) return;

    const timer = setTimeout(() => {
      updateParams("query", searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className={`flex flex-wrap gap-4 items-center ${isPending ? "opacity-60" : ""}`}>
      {/* 検索窓 */}
      <div className="flex gap-2 flex-1 min-w-[280px]">
        <input
          type="text"
          placeholder="氏名・会員番号・メールアドレスで検索"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateParams("query", searchTerm);
            }
          }}
          className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 役職フィルター */}
      <select
        value={initialRole}
        onChange={(e) => updateParams("role", e.target.value)}
        className="px-3 py-2 border rounded text-sm focus:outline-none bg-white"
      >
        <option value="all">全ての役職</option>
        <option value="一般会員">一般会員</option>
        <option value="執行部">執行部</option>
        <option value="管理者">管理者</option>
      </select>

      {/* ステータスフィルター */}
      <select
        value={initialStatus}
        onChange={(e) => updateParams("status", e.target.value)}
        className="px-3 py-2 border rounded text-sm focus:outline-none bg-white"
      >
        <option value="all">すべてのステータス</option>
        <option value="有効">有効</option>
        <option value="無効">無効</option>
      </select>
    </div>
  );
}
