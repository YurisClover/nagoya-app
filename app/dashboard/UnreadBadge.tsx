/**
 * Unread-count badge on the dashboard messages tile.
 *
 * Receives the server-fetched initial count as a prop (no flash of 0),
 * then polls /api/messages/unread-count every 5 mins to stay current.
 * Renders nothing at count <= 0; caps the display at "99+".
 */
"use client";

import { useState, useEffect } from "react";

export default function UnreadBadge({
  initialCount,
}: {
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    // Refresh the unread count periodically (interval below).
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/messages/unread-count");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setCount(data.count);
          }
        }
      } catch (error) {
        console.error("未読数の自動更新に失敗しました:", error);
      }
    }, 300000); // 5 mins

    // クリーンアップ処理
    return () => clearInterval(interval);
  }, []);

  if (count <= 0) return null;

  return (
    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
      {count > 99 ? "99+" : count}
    </span>
  );
}
