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
      className="btn btn-primary"
    >
      {isPending ? "更新中..." : "更新"}
    </button>
  );
}
