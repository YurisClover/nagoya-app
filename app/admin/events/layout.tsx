import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/guards";

type EventsLayoutProps = {
  children: ReactNode;
};

export default async function EventsLayout({ children }: EventsLayoutProps) {
  await requireAdmin();

  return children;
}
