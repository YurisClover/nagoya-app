import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';
import dns from 'node:dns';
import { nowJST } from '@/lib/datetime';
import crypto from 'crypto';

// ローカル開発環境（npm run dev）の時だけ IPv4 を優先にし、デプロイ環境（IPv6-Only等）では設定しない
if (process.env.NODE_ENV === 'development') {
  dns.setDefaultResultOrder('ipv4first');
}

// 1. セッションユーザーの型定義
interface SessionUser {
  member_id?: string;
  id?: string;
  name?: string | null;
  email?: string | null;
}

// 2. リクエストボディの型定義
interface SendNotificationBody {
  recipient_id?: string;
  recipientId?: string;
  title?: string;
  body?: string;
  parent_id?: string;
  parentId?: string;
}

export async function POST(request: Request) {
  try {
    // 1. サーバーセッションからログインユーザー情報を取得
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: '認証されていません。ログインしてください。' },
        { status: 401 }
      );
    }

    // 2. セッションから sender_id (member_id または id) を確定
    const user = session.user as SessionUser;
    const targetSenderId = user.member_id || user.id;

    if (!targetSenderId) {
      return NextResponse.json(
        { success: false, error: '送信者の member_id がセッションから取得できませんでした' },
        { status: 400 }
      );
    }

    // 3. リクエストボディに型を適用
    const bodyData = (await request.json()) as SendNotificationBody;

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json(
        { success: false, error: 'スプレッドシートの設定（環境変数）が不足しています' },
        { status: 500 }
      );
    }

    // 宛先 (recipient_id) の取得
    const rawRecipient = bodyData.recipient_id || bodyData.recipientId || 'all';

    const authClient = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // 4. Users シートを取得してアクティブなユーザーを把握
    const usersRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:Z',
    });

    const uRows = (usersRes.data.values as string[][]) || [];
    if (uRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Usersシートにデータが存在しません' },
        { status: 400 }
      );
    }

    const uHeaders = uRows[0].map((h) => h.toLowerCase().trim());
    let memberIdIdx = uHeaders.findIndex((h) => h === 'member_id' || h === 'id' || h === 'memberid');
    let userNameIdx = uHeaders.findIndex((h) => h === 'user_name' || h === 'username' || h === 'name');
    let roleIdx = uHeaders.findIndex((h) => h === 'role');
    let statusIdx = uHeaders.findIndex((h) => h === 'status');

    if (memberIdIdx === -1) memberIdIdx = 0; // A列
    if (userNameIdx === -1) userNameIdx = 1; // B列
    if (roleIdx === -1) roleIdx = 4;        // E列 (role)
    if (statusIdx === -1) statusIdx = 5;      // F列 (status)

    const userRows = uRows.slice(1);

    // ユーザー情報の構造化マップ（ID -> User, Name -> User）
    const userMapByMemberId = new Map<string, { memberId: string; name: string; role: string; isActive: boolean }>();
    const userMapByName = new Map<string, { memberId: string; name: string; role: string; isActive: boolean }>();

    userRows.forEach((row) => {
      const mId = row[memberIdIdx]?.toString().trim() || '';
      const uName = row[userNameIdx]?.toString().trim() || '';
      const role = row[roleIdx]?.toString().trim().toLowerCase() || '';
      const status = row[statusIdx]?.toString().trim().toLowerCase() || '';
      const isActive = status === 'active' || status === '有効';

      if (mId) {
        const userInfo = { memberId: mId, name: uName, role, isActive };
        userMapByMemberId.set(mId, userInfo);
        if (uName) userMapByName.set(uName, userInfo);
      }
    });

    let targetMemberIds: string[] = [];

    // 5. 宛先の判定 (全体指定 'all' / 管理者指定 'admin' / 個別指定)
    if (rawRecipient === 'all') {
      targetMemberIds = Array.from(userMapByMemberId.values())
        .filter((user) => user.memberId !== targetSenderId && user.isActive)
        .map((user) => user.memberId);

    } else if (rawRecipient === 'admin') {
      // 管理者宛ては複数人にバラさず、'admin' 宛ての1通として送信する
      targetMemberIds = ['admin'];

    } else {
      const targetUser = userMapByMemberId.get(rawRecipient) || userMapByName.get(rawRecipient);

      if (!targetUser) {
        return NextResponse.json(
          {
            success: false,
            error: `宛先「${rawRecipient}」に該当するユーザーが見つかりません。`,
          },
          { status: 400 }
        );
      }

      if (!targetUser.isActive) {
        return NextResponse.json(
          {
            success: false,
            error: `宛先「${targetUser.name || rawRecipient}」は非アクティブ（inactive）のためメッセージを送信できません。`,
          },
          { status: 400 }
        );
      }

      targetMemberIds = [targetUser.memberId];
    }

    // 重複IDの除去
    targetMemberIds = Array.from(new Set(targetMemberIds));

    // 保存日時は JST 形式 (+09:00付き) で生成
    const createdAt = nowJST();
    const parentId = bodyData.parent_id || bodyData.parentId || '';

    // 6. 対象メンバーそれぞれに対して1件ずつメッセージ行を作成（A〜I列の完全対応）
    const rowsToAppend = targetMemberIds.map((recipientMemberId) => {
      const isRead = String(targetSenderId).trim() === String(recipientMemberId).trim() ? 'true' : 'false';

      return [
        crypto.randomUUID(),          // A: message_id (UUID)
        targetSenderId,               // B: sender_id (送信者の member_id)
        recipientMemberId,            // C: recipient_id (受信者の member_id または 'admin')
        bodyData.title || '',         // D: subject (title)
        bodyData.body || '',          // E: body
        isRead,                       // F: is_read
        createdAt,                    // G: created_at (nowJST())
        'false',                      // H: delete_flag
        parentId,                     // I: parent_id
      ];
    });

    // 7. Messagesシートに一括保存
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Messages!A:I',
      valueInputOption: 'RAW', 
      requestBody: {
        values: rowsToAppend,
      },
    });

    return NextResponse.json({
      success: true,
      savedCount: rowsToAppend.length,
      totalCount: targetMemberIds.length,
      sender_id: targetSenderId,
      target_members: targetMemberIds,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('【送信時のエラー詳細】:', errorMessage);
    
    return NextResponse.json(
      { success: false, error: errorMessage || '送信中にエラーが発生しました' },
      { status: 500 }
    );
  }
}