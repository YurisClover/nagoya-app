/**
 * Client-side Firebase (FCM) initialization.
 *
 * This module is imported from AppShell (= every page) via
 * NotificationInitializer, so it must NEVER throw — even when config is
 * missing, during SSR, or on unsupported browsers. In those cases
 * `messaging` becomes null and callers skip notification logic via their
 * null checks; the rest of the app keeps working as usual.
 *
 * Env var names must match worker/index.ts and
 * /api/firebase-messaging-sw-dev (NEXT_PUBLIC_FIREBASE_*).
 */
import { getApps, initializeApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

// Keep the same export contract as the original lib/firebase.ts
// (`messaging` and `firebaseConfig`) — other branches may import both.
// `measurementId` is optional, so it is excluded from the required check.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Required keys (everything except measurementId). If any are missing we
// disable notifications only — the app itself still boots.
const requiredConfig = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
};

function createMessaging(): Messaging | null {
  // Never initialize Messaging during SSR (no `window` on the server).
  if (typeof window === "undefined") return null;

  // Env not configured (e.g. local dev): disable notifications only.
  const missingKeys = Object.entries(requiredConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missingKeys.length > 0) {
    console.warn("Firebase config missing; notifications disabled:", missingKeys);
    return null;
  }

  try {
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    return getMessaging(app);
  } catch (error) {
    // getMessaging can throw on unsupported browsers.
    console.warn("Failed to initialize Firebase Messaging:", error);
    return null;
  }
}

export const messaging = createMessaging();
export { firebaseConfig };
