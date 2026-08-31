/**
 * Root entry (/). No UI: routes by session only.
 * Unauthenticated -> /login. Authenticated -> role landing path via
 * getLandingPath (admin -> /admin, member -> /dashboard).
 * Login success lands here first, so landing rules live in one place.
 */
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLandingPath } from "@/lib/routes";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(getLandingPath(session.user.role));
}
