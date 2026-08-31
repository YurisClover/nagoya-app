/**
 * Shared logout handler for AppHeader (member side) and the admin Sidebar.
 * Extracted so token-cleanup fixes land in one place - the two copies had
 * already drifted into duplication once.
 *
 * Order matters:
 * 1. Ask the server to clear this browser's token from the Users sheet.
 *    The route skips deletion when the sheet already holds a different
 *    device's token, so logging out here never silences another device.
 * 2. Invalidate the browser-side FCM registration (deleteToken).
 * 3. Drop the localStorage cache used by NotificationInitializer.
 * 4. signOut - in `finally`, so a cleanup failure can never block logout.
 */
"use client";

import { signOut } from "next-auth/react";
import { deleteToken } from "firebase/messaging";
import { messaging } from "@/lib/firebase";

export async function logoutWithFcmCleanup(): Promise<void> {
  try {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("fcm_token") : null;

    const response = await fetch("/api/remove-fcm-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      console.warn("Failed to clear the FCM token from the Users sheet");
    }

    if (typeof window !== "undefined" && messaging) {
      try {
        await deleteToken(messaging);
      } catch (error) {
        console.warn("Failed to invalidate the browser FCM token:", error);
      }
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem("fcm_token");
      localStorage.removeItem("fcm_token_sent");
    }
  } catch (error) {
    console.error("Logout cleanup error:", error);
  } finally {
    await signOut({ callbackUrl: "/login" });
  }
}
