import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import {
  getEventsFromSheet,
} from "@/lib/sheets/events";

import {
  EventCreateForm,
} from "./eventCreateForm";

import {
  EventList,
} from "./eventsList";

export default async function EventsPage() {
  const session =
    await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role =
    session.user.role;

  if (
    role !== "admin" &&
    role !== "executive"
  ) {
    redirect("/admin");
  }

  const events =
    await getEventsFromSheet();

  return (
    <main>
      <h1>
        イベント管理
      </h1>

      <EventCreateForm />

      <hr />

      <EventList
        events={events}
      />
    </main>
  );
}


