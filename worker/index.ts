/// <reference lib="webworker" />

import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage,} from "firebase/messaging/sw";
declare const self: ServiceWorkerGlobalScope;
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const messaging = getMessaging(firebaseApp);

onBackgroundMessage(messaging, async (payload) => {
  console.log("[FCM] バックグラウンド通知を受信:", payload);
  const title = payload.data?.title ?? payload.notification?.title ?? "新着通知";
  const body = payload.data?.body ?? payload.notification?.body ?? "";
  const url = payload.data?.url ?? "/";
  await self.registration.showNotification(title, { body,  data: { url, },  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil( self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});