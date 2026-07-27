import { NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { google } from 'googleapis';
import { randomUUID } from 'crypto'; // 🌟 UUID生成用

// 環境変数の取得（GOOGLE_ が無ければ FIREBASE_ の値を自動で使用）
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
const projectId = process.env.FIREBASE_PROJECT_ID;
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

// 1. Firebase Admin SDK の初期化
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: projectId,
      clientEmail: clientEmail,
      privateKey: privateKey,
    }),
  });
}

// 2. Google Sheets API の初期化
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

export async function POST(request: Request) {
  try {
    if (!clientEmail || !privateKey || !spreadsheetId) {
      console.error('❌ 環境変数が足りません:', {
        hasClientEmail: !!clientEmail,
        hasPrivateKey: !!privateKey,
        hasSpreadsheetId: !!spreadsheetId,
      });
      return NextResponse.json(
        { success: false, error: 'サーバーの環境変数（メール・鍵・スプレッドシートID）が不足しています。' },
        { status: 500 }
      );
    }

    // 🌟 送信者ID (senderId) と 宛先ID (recipientId) をリクエストボディから受け取る
    const { title, body, url, senderId, recipientId } = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { success: false, error: 'タイトルと本文は必須です' },
        { status: 400 }
      );
    }

    if (!senderId || !recipientId) {
      return NextResponse.json(
        { success: false, error: '送信者ID (senderId) と宛先ID (recipientId) は必須です' },
        { status: 400 }
      );
    }

    // ----------------------------------------------------
    // ステップ 2: Google スプレッドシート (Messagesシート) へメッセージ内容を保存
    // ----------------------------------------------------
    const messageId = randomUUID(); // 🌟 UUID を生成（例: "f47ac10b-58cc-4372-a567-0e02b2c3d479"）
    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: 'Messages!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          messageId,   // A: message_id (UUID)
          senderId,    // B: sender_id (送信者の member_id)
          recipientId, // C: recipient_id (宛先の member_id または group_id)
          title,       // D: subject (タイトル)
          body,        // E: body (本文)
          false,       // F: is_read (既読フラグ: 初期値 false)
          now,         // G: created_at (作成日時)
        ]],
      },
    });

    // ----------------------------------------------------
    // ステップ 3: FCM へ通知リクエスト
    // ----------------------------------------------------
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        url: url || '/',
        badge: '1',
      },
      topic: recipientId || 'all', // recipientId が 'all' または指定されたトピック宛に送信
    };

    const fcmResponse = await getMessaging().send(message);

    return NextResponse.json({
      success: true,
      message: '保存と通知の配信が完了しました',
      fcmMessageId: fcmResponse,
      messageId: messageId,
    });
  } catch (error: any) {
    console.error('API処理エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '内部エラーが発生しました' },
      { status: 500 }
    );
  }
}