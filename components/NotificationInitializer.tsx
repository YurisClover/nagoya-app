"use client";

import { useEffect, useRef, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { getClientMessaging } from './firebase';

type ToastData = {
  title: string;
  body: string;
  url?: string;
};

// 🌟 ログイン中の会員情報の型定義（実際のプロジェクトに合わせて調整してください）
type UserProfile = {
  member_id: string;      // 例: "10001235"
  group_id?: string;     // 例: "GRP_001" (所属なしの場合は null/undefined)
  is_executive?: boolean; // 執行部かどうか (true/false)
};

export default function NotificationInitializer() {
  const initialized = useRef(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  // アプリ起動中・画面復帰時にバッジを消去するフック
  useEffect(() => {
    const clearBadge = () => {
      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch((err) => {
          console.error('バッジの消去に失敗しました:', err);
        });
      }
    };

    // 1. コンポーネント読み込み時（アプリ起動時）に消去
    clearBadge();

    // 2. バックグラウンドからアプリに戻ってきた（フォーカスされた）時に消去
    window.addEventListener('focus', clearBadge);
    return () => window.removeEventListener('focus', clearBadge);
  }, []);

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

        // 4. アプリ起動中（フォアグラウンド）の通知受信リスナー
        onMessage(messaging, (payload) => {
          console.log('🔔 アプリ起動中に通知を受信しました:', payload);

          const title = payload.notification?.title || '新着メッセージ';
          const body = payload.notification?.body || '';
          const url = payload.data?.url || '/';

          // トーストを表示（5秒後に自動消去）
          setToast({ title, body, url });
          setTimeout(() => setToast(null), 5000);
        });

        // 5. FCMトークンの取得
        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (!token) return;

        // 🌟 6. 複数トピック（全会員 / 個人 / グループ / 執行部）への自動登録
        try {
          // localStorage や Context 等からログイン会員情報を取得（プロジェクトの仕様に合わせて変更）
          const storedUser = localStorage.getItem('user_profile');
          const currentUser: UserProfile | null = storedUser ? JSON.parse(storedUser) : null;

          // 購読するトピックのリストを動的に作成
          const topicsToSubscribe: string[] = ['all']; // ① 全会員向けは必須

          if (currentUser?.member_id) {
            topicsToSubscribe.push(currentUser.member_id); // ② 個人指定（会員ID宛て）
          }
          if (currentUser?.group_id) {
            topicsToSubscribe.push(currentUser.group_id); // ③ グループ宛て
          }
          if (currentUser?.is_executive) {
            topicsToSubscribe.push('executive'); // ④ 執行部のみ
          }

          // リストにあるすべてのトピックを登録
          for (const topic of topicsToSubscribe) {
            await fetch('/api/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, topic }),
            });
          }

          console.log('✅ トピック登録が完了しました:', topicsToSubscribe);
        } catch (e) {
          console.error('トピック登録失敗:', e);
        }

        // 7. 保存済みトークンと一致する場合は API 送信をスキップ
        const savedToken = localStorage.getItem('fcm_token');
        if (savedToken === token) {
          console.log('ℹ️ すでに保存済みのトークンのため、送信をスキップしました');
          return;
        }

        console.log('🔑 新しいトークンを取得しました:', token);

        // 8. バックエンドへ送信（スプレッドシート保存）
        const res = await fetch('/api/save-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        // 9. 保存成功時のみ localStorage へ記録
        if (res.ok) {
          localStorage.setItem('fcm_token', token);
        }
      } catch (error) {
        console.error('Firebase通知エラー:', error);
      }
    };

    initializeNotification();
  }, []);

  // アプリ起動中に届いた時のポップアップ（トースト UI）
  if (!toast) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-all duration-300 animate-bounce-in">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-bold text-sm text-gray-900 dark:text-white">
            {toast.title}
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
            {toast.body}
          </p>
        </div>
        <button
          onClick={() => setToast(null)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm ml-2"
        >
          ✕
        </button>
      </div>
      {toast.url && (
        <a
          href={toast.url}
          onClick={() => setToast(null)}
          className="inline-block mt-2 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
        >
          詳細を見る →
        </a>
      )}
    </div>
  );
}