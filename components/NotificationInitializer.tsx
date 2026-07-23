"use client";

import { useEffect, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { getClientMessaging } from './firebase'; // パスは環境に合わせて調整してください

export default function NotificationInitializer() {
  const initialized = useRef(false);

  useEffect(() => {
    // React 18 (Strict Mode) での2回実行を防止
    if (initialized.current) return;
    initialized.current = true;

    const initializeNotification = async () => {
      try {
        // ブラウザ環境チェック
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        // 1. 通知許可をリクエスト
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('通知許可が得られませんでした');
          return;
        }

        // 2. Service Worker を手動登録＆準備完了を待機
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;

        // 3. Firebase Messaging の取得
        const messaging = await getClientMessaging();
        if (!messaging) return;

        // 4. FCMトークンの取得
        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (!token) return;

        // 5. 保存済みトークンと一致する場合は API 送信をスキップ
        const savedToken = localStorage.getItem('fcm_token');
        if (savedToken === token) {
          console.log('ℹ️ すでに保存済みのトークンのため、送信をスキップしました');
          return;
        }

        console.log('🔑 新しいトークンを取得しました:', token);

        // 6. バックエンドへ送信（スプレッドシート保存）
        const res = await fetch('/api/save-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        // 7. 保存成功時のみ localStorage へ記録
        if (res.ok) {
          localStorage.setItem('fcm_token', token);
        }
      } catch (error) {
        console.error('Firebase通知エラー:', error);
      }
    };

    initializeNotification();
  }, []);

  return null;
}