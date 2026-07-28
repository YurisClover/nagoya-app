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
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="text-xl font-bold text-gray-800 mb-4">ダッシュボード</div>

      {/* 1. 指標 */}
      <Metrics data={metricsData} />

      {/* 2. アクティビティ & クイックアクション */}
      <div className="flex gap-6 w-full">
        <Activity items={activityData} />
        <QuickAction />
      </div>

      {/* 3. 今月のイベント出席状況（新設） */}
      <EventAttendance items={eventAttendanceData} />
    </main>
  );
}