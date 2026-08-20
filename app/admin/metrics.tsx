import { DashboardMetrics } from "@/lib/sheets";

// Props の型定義
type MetricsProps = {
  data: DashboardMetrics;
};

// Props から { data } を受け取る
export default function Metrics({ data }: MetricsProps) {
  const {
    totalMembers,
    newMembersThisMonth,
    activeMembers,
    inactiveMembers,
    monthlyEventsCount,
    eventRegistrationsCount,
    unreadMessagesCount,
  } = data; // 受け取った data から展開

  return (
    <div className="flex gap-4 flex-wrap">
      {/* 1. 総会員数 */}
      <div className="card min-w-[150px] flex-1">
        <p className="text-sm text-gray-500 font-medium">総会員数</p>
        <p className="text-2xl font-bold text-gray-900 mt-1 truncate">
          {totalMembers.toLocaleString("ja-JP")}{" "}
          <span className="text-sm font-normal text-gray-500">名</span>
        </p>
        <p className="text-xs text-emerald-600 font-medium mt-2">
          +{newMembersThisMonth} 今月
        </p>
      </div>

      {/* 2. 有効会員 */}
      <div className="card min-w-[150px] flex-1">
        <p className="text-sm text-gray-500 font-medium">有効会員</p>
        <p className="text-2xl font-bold text-green-600 mt-1 truncate">
          {activeMembers.toLocaleString("ja-JP")}{" "}
          <span className="text-sm font-normal text-gray-500">名</span>
        </p>
        <p className="text-xs text-gray-500 font-medium mt-2 truncate">
          無効 {inactiveMembers} 名
        </p>
      </div>

      {/* 3. 今月のイベント */}
      <div className="card min-w-[150px] flex-1">
        <p className="text-sm text-gray-500 font-medium">今月のイベント</p>
        <p className="text-2xl font-bold text-blue-600 mt-1 truncate">
          {monthlyEventsCount.toLocaleString("ja-JP")}{" "}
          <span className="text-sm font-normal text-gray-500">件</span>
        </p>
        <p className="text-xs text-gray-500 font-medium mt-2">
          出席登録 {eventRegistrationsCount} 件
        </p>
      </div>

      {/* 4. 未読のメッセージ */}
      <div className="card min-w-[150px] flex-1">
        <p className="text-sm text-gray-500 font-medium">未読のメッセージ</p>
        <p className="text-2xl font-bold text-red-500 mt-1 truncate">
          {unreadMessagesCount.toLocaleString("ja-JP")}{" "}
          <span className="text-sm font-normal text-gray-500">件</span>
        </p>
        <p className="text-xs text-gray-500 font-medium mt-2">
          会員からの受信
        </p>
      </div>
    </div>
  );
}