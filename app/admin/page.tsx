import {getDashboardMetrics,getRecentActivities,getEventAttendanceList,} from "@/lib/sheets";
import Metrics from "./metrics";
import Activity from "./activity";
import QuickAction from "./quickAction";
import EventAttendance from "./eventAttendance";
import { requireAdmin } from "@/lib/guards";

export default async function AdminHomePage() {
  // check isAdmin
  await requireAdmin();
  // 親で3つのデータを同時に並列取得
  const [metricsData, activityData, eventAttendanceData] = await Promise.all([
    getDashboardMetrics(),
    getRecentActivities(),
    getEventAttendanceList(),
  ]);

  return (
    <main className="space-y-6">
      <div className="mb-4 text-xl font-bold">ダッシュボード</div>

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