"use client";

import { useState, useEffect } from "react";

export default function UnreadBadge({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    // 30秒ごとにAPIを叩く
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
    }, 60000); // 60000ms = 60秒

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