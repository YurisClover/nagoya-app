import ScheduleClient from "./ScheduleClient";
import { requireUser } from "@/lib/guards";

export const dynamic = "force-dynamic";
export default async function SchedulePage() {
  const session = await requireUser();
  return <ScheduleClient role={session.user.role} />;
}
