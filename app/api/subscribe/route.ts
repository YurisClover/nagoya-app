import { NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// 1. リクエストボディの型を定義
interface SubscribeRequestBody {
  token?: string;
}

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
    // 2. request.json() に型を適用
    const body = (await request.json()) as SubscribeRequestBody;
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'トークンが必要です' }, { status: 400 });
    }

    // 🌟 受け取ったトークンを 'all' トピック（全員向けグループ）に登録する
    await getMessaging().subscribeToTopic(token, 'all');

    return NextResponse.json({ success: true, message: "'all' トピックに登録しました" });
  } catch (error: unknown) { // 3. catch句のエラーを unknown 型に変更し、安全に判定
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('トピック登録エラー:', errorMessage);
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}