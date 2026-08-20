"use server";

import { updateTag } from "next/cache";

// bust every cache that dashboard need
export async function refreshDashboardAction() {
    updateTag("dashboard-metrics");
    updateTag("recent-activities");
    updateTag("event-attendance-list");
}
