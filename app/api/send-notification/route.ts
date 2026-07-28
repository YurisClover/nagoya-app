import { NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { google } from 'googleapis';
import { randomUUID } from 'crypto';

// 環境変数の取得
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

// 🌟 recipientId（送信先種別）に応じて対象会員の member_id 配列を返す関数
async function getTargetMemberIds(sheetsApi: typeof sheets, spreadsheetIdStr: string, recipientId: string): Promise<string[]> {
  // 個人IDが直接指定されている場合（例: 'MEM_001'）
  if (!['all', 'executive'].includes(recipientId) && !recipientId.startsWith('GRP_')) {
    return [recipientId];
  }

  try {
    // 1. 全会員 'all' または 執行部 'executive' の場合 -> Users シートを参照
    if (recipientId === 'all' || recipientId === 'executive') {
      const res = await sheetsApi.spreadsheets.values.get({
        spreadsheetId: spreadsheetIdStr,
        range: 'Users!A2:C', // A列: member_id, C列: is_executive と想定
      });
      const rows = res.data.values || [];

      if (recipientId === 'all') {
        // A列 (row[0]) の member_id を全員分取得
        const memberIds = rows.map((row) => row[0]).filter(Boolean);
        return memberIds.length > 0 ? memberIds : [recipientId];
      }

      if (recipientId === 'executive') {
        // C列 (row[2]) が true の member_id のみ取得
        const executiveIds = rows
          .filter((row) => row[2] === 'true' || row[2] === true || row[2] === 'TRUE')
          .map((row) => row[0])
          .filter(Boolean);
        return executiveIds.length > 0 ? executiveIds : [recipientId];
      }
    }

    // 2. グループ 'GRP_...' の場合 -> Groups シートを参照
    if (recipientId.startsWith('GRP_')) {
      const res = await sheetsApi.spreadsheets.values.get({
        spreadsheetId: spreadsheetIdStr,
        range: 'Groups!A2:B', // A列: group_id, B列: member_id と想定
      });
      const rows = res.data.values || [];

      const groupMemberIds = rows
        .filter((row) => row[0] === recipientId)
        .map((row) => row[1])
        .filter(Boolean);

      return groupMemberIds.length > 0 ? groupMemberIds : [recipientId];
    }
  } catch (err) {
    console.error('⚠️ 会員情報の取得に失敗したため、受け取ったIDで実行します:', err);
  }

  return [recipientId];
}

export async function POST(request: Request) {
  try {
    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json(
        { success: false, error: '環境変数が不足しています' },
        { status: 500 }
      );
    }

    const { title, body, url, senderId, recipientId } = await request.json();

    if (!title || !body || !senderId || !recipientId) {
      return NextResponse.json(
        { success: false, error: '必須項目（title, body, senderId, recipientId）が不足しています' },
        { status: 400 }
      );
    }

    // ----------------------------------------------------
    // ステップ 1: 対象会員の member_id 配列を取得
    // ----------------------------------------------------
    const targetMemberIds = await getTargetMemberIds(sheets, spreadsheetId, recipientId);
    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    // ----------------------------------------------------
    // ステップ 2: C列 (recipient_id) に各会員の member_id をセットして行を作成
    // ----------------------------------------------------
    const rowsToAppend = targetMemberIds.map((memberId) => [
      randomUUID(), // A: message_id
      senderId,     // B: sender_id
      memberId,     // 🌟 C: recipient_id (個人の member_id)
      title,        // D: subject
      body,         // E: body
      false,        // F: is_read
      now,          // G: created_at
    ]);

    // Google スプレッドシート (Messagesシート) へ保存
    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: 'Messages!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rowsToAppend,
      },
    });

    // ----------------------------------------------------
    // ステップ 3: FCM へ通知リクエスト（トピック宛てに一括配信）
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
      topic: recipientId || 'all',
    };

    const fcmResponse = await getMessaging().send(message);

    return NextResponse.json({
      success: true,
      message: `${targetMemberIds.length} 名分のメッセージ保存と通知配信が完了しました`,
      fcmMessageId: fcmResponse,
      savedCount: targetMemberIds.length,
    });
  } catch (error: any) {
    console.error('API処理エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || '内部エラーが発生しました' },
      { status: 500 }
    );
  }
}