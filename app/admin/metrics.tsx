import { getMemberCounts } from "@/lib/sheets";

export const revalidate = 0; // リアルタイム取得

export default async function Metrics() {
  // 総会員数と有効会員数を一括取得
  const { totalMembers, activeMembers } = await getMemberCounts();

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
    {} 
  </p>
</div>
  );
}