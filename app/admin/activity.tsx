import type { ActivityItem } from "@/lib/sheets";

// Props の型定義を追加
type ActivityProps = {items: ActivityItem[];};

// 親から { items } を受け取る
export default function Activity({ items }: ActivityProps) {
  return (
    <div className="card flex-1">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900">
          最近のアクティビティ
        </h2>
        <span className="text-xs text-gray-400">直近5件</span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          アクティビティ履歴はまだありません
        </p>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0"
            >
              <p className="text-gray-800 font-medium leading-tight">
                {item.description}
              </p>
              <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                {item.timestamp}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}