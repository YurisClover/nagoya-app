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

// 🌟 recipientId（'all' / 'G0001' 等 / member_id / ユーザー名）に応じて対象会員の member_id 配列を抽出する関数
async function getTargetMemberIds(sheetsApi: typeof sheets, spreadsheetIdStr: string, recipientId: string): Promise<string[]> {
  // ----------------------------------------------------
  // CASE 1: 全会員 ('all') の場合 -> Users シートの A列(member_id) を取得
  // ----------------------------------------------------
  if (recipientId === 'all') {
    try {
      const res = await sheetsApi.spreadsheets.values.get({
        spreadsheetId: spreadsheetIdStr,
        range: 'Users!A2:A',
      });
      const rows = res.data.values || [];
      const memberIds = rows.map((row) => row[0]?.toString().trim()).filter(Boolean);
      return memberIds.length > 0 ? memberIds : ['all'];
    } catch (err) {
      console.error('⚠️ Usersシート読み込みエラー:', err);
      return ['all'];
    }
  }

  // ----------------------------------------------------
  // CASE 2: グループ指定の場合 ('G' から始まるID)
  // -> Groups シートの C列 (member_ids: カンマ区切り) を分解して取得
  // ----------------------------------------------------
  if (recipientId.startsWith('G')) {
    try {
      const res = await sheetsApi.spreadsheets.values.get({
        spreadsheetId: spreadsheetIdStr,
        range: 'Groups!A2:C', // A: group_id, B: group_name, C: member_ids
      });
      const rows = res.data.values || [];

      // A列 (group_id) が一致する行を検索
      const targetRow = rows.find((row) => row[0] === recipientId);

      if (targetRow && targetRow[2]) {
        // C列のカンマ区切り文字列 (例: "10001234, 10001235") を分解・トリム
        const memberIds = targetRow[2]
          .toString()
          .split(',')
          .map((id: string) => id.trim())
          .filter(Boolean);

        if (memberIds.length > 0) {
          return memberIds;
        }
      }
    } catch (err) {
      console.error('⚠️ Groupsシート読み込みエラー:', err);
    }
  }

  // ----------------------------------------------------
  // CASE 3: 個人指定の場合 (member_id または ユーザー名 が入力された場合)
  // -> Users シートを参照して、一致する member_id を返す
  // ----------------------------------------------------
  try {
    const res = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: spreadsheetIdStr,
      range: 'Users!A2:B', // A: member_id, B: user_name
    });
    const rows = res.data.values || [];

    // A列 (member_id) または B列 (user_name) に一致する行を検索
    const matchedUser = rows.find((row) => row[0] === recipientId || row[1] === recipientId);

    if (matchedUser && matchedUser[0]) {
      return [matchedUser[0].toString().trim()];
    }
  } catch (err) {
    console.error('⚠️ Usersシート個人検索エラー:', err);
  }

  // 一致するものがない場合は入力値をそのまま返す
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
    // ステップ 2: 各会員の member_id ごとに行を作成して保存
    // ----------------------------------------------------
    const rowsToAppend = targetMemberIds.map((memberId) => [
      randomUUID(), // A: message_id
      senderId,     // B: sender_id
      memberId,     // C: recipient_id (個人の member_id)
      title,        // D: subject (例: "(全会員) 研修のお知らせ" / "(執行部) 次回会議について")
      body,         // E: body
      false,        // F: is_read
      now,          // G: created_at
    ]);

    // Google スプレッドシート (Messagesシート) へ一括保存
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