"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshDashboardAction } from "./action";

export default function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await refreshDashboardAction(); // bust cache (server)
          router.refresh(); // soft refresh
        })
      }
      className="btn btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
    >
      {isPending ? "更新中..." : "更新"}
    </button>
  );
}
