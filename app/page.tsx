import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLandingPath } from "@/lib/routes";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(getLandingPath(session.user.role));
}