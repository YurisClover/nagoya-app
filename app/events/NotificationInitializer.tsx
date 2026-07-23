'use client';

import { useEffect } from 'react';
import { getToken } from "firebase/messaging";
import { messaging } from "./firebase"; 

export default function NotificationInitializer() {
  useEffect(() => {
    // コンソールからコピーした「ウェブプッシュ証明書」の鍵ペア
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    const requestPermissionAndGetToken = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // ★追加：messaging が null の場合（ブラウザ非対応など）はここで処理を止める
        if (!messaging || !vapidKey) {
          console.warn("このブラウザはプッシュ通知をサポートしていません。");
          return;
        }

        // これでTypeScriptは「messagingは絶対にnullじゃない」と安心し、エラーが消えます
        const token = await getToken(messaging, { vapidKey });
        
        if (token) {
          console.log("=== トークン取得成功 ===");
          console.log(token);
        } else {
          console.warn("トークン取得失敗");
        }
      } catch (error) {
        console.error("Firebase通知エラー (ここを確認):", error);
      }
    };

    requestPermissionAndGetToken();
  }, []);

  return null;
}