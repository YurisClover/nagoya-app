import { redirect,} from "next/navigation";
import { auth,} from "@/auth";
import ScheduleClient from "./ScheduleClient";

export const dynamic = "force-dynamic";
export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user) {
    redirect( "/login", );
  }
  return (
    <ScheduleClient role={ session.user.role } />
  );
}