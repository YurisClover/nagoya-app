import { NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Firebase Admin SDK 初期化
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'トークンが必要です' }, { status: 400 });
    }

    // 🌟 受け取ったトークンを 'all' トピック（全員向けグループ）に登録する
    await getMessaging().subscribeToTopic(token, 'all');

    return NextResponse.json({ success: true, message: "'all' トピックに登録しました" });
  } catch (error: any) {
    console.error('トピック登録エラー:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}