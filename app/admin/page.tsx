import { getDashboardMetrics, getRecentActivities, getEventAttendanceList } from "@/lib/sheets";
import Metrics from "./metrics";
import Activity from "./activity";
import QuickAction from "./quickAction";
import EventAttendance from "./eventAttendance";
import { requireAdmin } from "@/lib/guards";
import RefreshButton from "./refreshButton";

export default async function AdminHomePage() {
  // check isAdmin
  const session = await requireAdmin();
  const currentMemberId = session?.user?.id || "admin";

  // ③ 取得したIDを getDashboardMetrics に渡す
  const [metricsData, activityData, eventAttendanceData] = await Promise.all([
    getDashboardMetrics(currentMemberId), 
    getRecentActivities(),
    getEventAttendanceList(),
  ]);

  return (
    <main className="space-y-6">
      <div className="mb-4 flex item-center justify-between">
        <div className="text-xl font-bold">ダッシュボード</div>
        <RefreshButton />
      </div>

      {/* 1. 指標 */}
      <Metrics data={metricsData} />

      {/* 2. アクティビティ & クイックアクション */}
      <div className="flex w-full flex-col gap-6 lg:flex-row">
        <Activity items={activityData} />
        <QuickAction />
      </div>

      {/* 3. 今月のイベント出席状況（新設） */}
      <EventAttendance items={eventAttendanceData} />
    </main>
  );
}