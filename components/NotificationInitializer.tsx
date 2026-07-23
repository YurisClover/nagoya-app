'use client';

import { useEffect } from 'react';
import { getToken } from "firebase/messaging";
import { getClientMessaging } from "./firebase"; 

export default function NotificationInitializer() {
  useEffect(() => {
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    const requestPermissionAndGetToken = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // 非同期でmessagingを取得
        const messaging = await getClientMessaging();

        if (!messaging || !vapidKey) {
          console.warn("このブラウザはプッシュ通知をサポートしていません。");
          return;
        }

        const token = await getToken(messaging, { vapidKey });
        
        if (token) {
          console.log("=== トークン取得成功 ===");
          console.log(token);
          
          await fetch('/api/save-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          });
        } else {
          console.warn("トークン取得失敗");
        }
      } catch (error) {
        console.error("Firebase通知エラー:", error);
      }
    };

    requestPermissionAndGetToken();
  }, []);

  return null;
}