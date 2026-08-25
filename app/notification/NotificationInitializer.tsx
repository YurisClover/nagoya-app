"use client";

import { useEffect, useRef, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '@/lib/firebase'; 

// ==========================================
// 型定義
// ==========================================

// アプリ起動中に表示する「トースト通知」のデータ型
type ToastData = {
  title: string;
  body: string;
  url?: string;
};

// ログイン中の会員情報の型（プロジェクトに合わせて調整してください）
// type UserProfile = {
//   member_id: string;      // 例: "10001235"
//   group_id?: string;      // 例: "GRP_001" (所属なしの場合は null/undefined)
//   is_executive?: boolean; // 執行部かどうか (true/false)
// };

// ==========================================
// メインコンポーネント
// ==========================================

export default function NotificationInitializer() {
  // React 18のStrict Mode（開発環境）でuseEffectが2回実行されるのを防ぐためのフラグ
  const initialized = useRef(false);
  
  // アプリ起動中のポップアップ（トースト）を表示・非表示するためのステート
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    // 既に初期化済みの場合は何もしない（2回実行防止）
    //if (process.env.NODE_ENV === "development") return;
    if (initialized.current) return;
    initialized.current = true;

    // 非同期で通知のセットアップを行う関数
    const setupNotifications = async () => {
      try {
        // --------------------------------------------------
        // [Step 1] ブラウザの環境チェック
        // --------------------------------------------------
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
          console.warn('ℹ️ このブラウザはプッシュ通知（Service Worker）をサポートしていません。');
          return;
        }

        // --------------------------------------------------
        // [Step 2] ユーザーへ通知の許可を求める
        // --------------------------------------------------
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('⚠️ ユーザーからプッシュ通知の許可が得られませんでした。');
          return;
        }

        // --------------------------------------------------
        // [Step 3] Firebase VAPIDキーの確認
        // --------------------------------------------------
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
          console.warn('⚠️ VAPIDキーが見つかりません。.env.local などを確認してください。');
          return;
        }

        // --------------------------------------------------
        // [Step 4] Service Worker の登録と Messaging の確認
        // --------------------------------------------------
        //const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const serviceWorkerUrl = process.env.NODE_ENV === "development"
         ? "/api/firebase-messaging-sw-dev"
         : "/firebase-messaging-sw.js";
        const registration = await navigator.serviceWorker.register( serviceWorkerUrl,{ scope: "/",
            },
           );
        await navigator.serviceWorker.ready;

        // ★ 修正: インポートした messaging が null じゃないか（ブラウザ対応しているか）チェック
        if (!messaging) {
          console.warn('⚠️ Firebase Messagingの初期化に失敗したか、ブラウザが非対応です。');
          return;
        }

        // --------------------------------------------------
        // [Step 5] アプリを開いている時（フォアグラウンド）の通知受信設定
        // --------------------------------------------------
        onMessage(messaging, (payload) => {
          console.log('🔔 アプリ起動中に新しい通知を受信しました:', payload);

          // const title = payload.notification?.title || '新着メッセージ';
          // const body = payload.notification?.body || '';
          const title = payload.data?.title || payload.notification?.title || '新着メッセージ';
          const body = payload.data?.body || payload.notification?.body || '';
          const url = payload.data?.url || '/';

          // 画面にトースト（ポップアップ）を表示し、5秒後に自動で消す
          setToast({ title, body, url });
          setTimeout(() => setToast(null), 5000);
        });

        // --------------------------------------------------
        // [Step 6] プッシュ通知用のデバイストークンを取得
        // --------------------------------------------------
        const token = await getToken(messaging, {
          vapidKey: vapidKey,
          serviceWorkerRegistration: registration,
        });

        if (!token) {
          console.warn('⚠️ プッシュ通知用のトークンが取得できませんでした。');
          return;
        }

        // --------------------------------------------------
        // [Step 7] トピック登録（全会員・個人・グループなど）
        // --------------------------------------------------
        // try {
        //   const storedUser = localStorage.getItem('user_profile');
        //   const currentUser: UserProfile | null = storedUser ? JSON.parse(storedUser) : null;
        //   const topicsToSubscribe: string[] = ['all'];

        //   if (currentUser) {
        //     if (currentUser.member_id)  topicsToSubscribe.push(currentUser.member_id);
        //     if (currentUser.group_id)   topicsToSubscribe.push(currentUser.group_id);
        //     if (currentUser.is_executive) topicsToSubscribe.push('executive');
        //   }

        //   for (const topic of topicsToSubscribe) {
        //     await fetch('/api/subscribe', {
        //       method: 'POST',
        //       headers: { 'Content-Type': 'application/json' },
        //       body: JSON.stringify({ token, topic }),
        //     });
        //   }
        //   console.log('✅ トピックの登録が完了しました:', topicsToSubscribe);
        // } catch (e) {
        //   console.error('❌ トピック登録中にエラーが発生しました:', e);
        // }

        // --------------------------------------------------
        // [Step 7] 取得したトークンをサーバーへ保存
        // --------------------------------------------------
        const savedToken = localStorage.getItem('fcm_token');
        if (savedToken === token) {
        console.log(':インフォメーション: トークンは既に保存されているため、サーバーへの送信をスキップします。');
          }else {
           console.log(':鍵: 新しいデバイストークンを取得しました:', token);}

        const res = await fetch('/api/save-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (res.ok) {
          localStorage.setItem('fcm_token', token);
        }

      } catch (error) {
        console.error('❌ プッシュ通知の初期化中に重大なエラーが発生しました:', error);
      }
    };

    setupNotifications();
  }, []);

  // ==========================================
  // レンダリング（トースト通知のUI）
  // ==========================================
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
          aria-label="閉じる"
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