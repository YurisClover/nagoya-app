import { requireUser } from "@/lib/guards";
import EventsClient from "./eventsClient";

export default async function EventsPage() {
    const session = await requireUser();

    return<EventsClient role={session.user?.role} />
}