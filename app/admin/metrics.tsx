import { getDashboardMetrics } from "@/lib/sheets";

export const revalidate = 0; // リアルタイム取得

export default async function Metrics() {
  const {
    totalMembers,
    activeMembers,
    monthlyEventsCount,
    unreadMessagesCount,
  } = await getDashboardMetrics();

  return (
    <div className="flex gap-6">
  <p>
    総会員数
    <br />
    {totalMembers} 
  </p>
  <p>
    有効会員数
    <br />
    {activeMembers} 
  </p>
  <p>
    今月のイベント
    <br />
    {monthlyEventsCount} 
  </p>
  <p>
    未読メッセージ
    <br />
    {unreadMessagesCount} 
  </p>
</div>
  );
}