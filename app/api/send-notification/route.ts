import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/guards';
import dns from 'node:dns';
import { nowJST } from '@/lib/datetime';
import crypto from 'crypto';
import { getSheetsClient } from "@/lib/sheets/googleapis";
import { getFirebaseAdminMessaging } from "@/lib/firebase-admin";

// ローカル開発環境（npm run dev）の時だけ IPv4 を優先にし、デプロイ環境（IPv6-Only等）では設定しない
if (process.env.NODE_ENV === 'development') {
  dns.setDefaultResultOrder('ipv4first');
}

// 2. リクエストボディの型定義
interface SendNotificationBody {
  recipient_id?: string;
  recipientId?: string;
  title?: string;
  body?: string;
  url?: string;
  parent_id?: string;
  parentId?: string;
}

export async function POST(request: Request) {
  try {
    // 1. サーバーセッションからログインユーザー情報を取得
    const apiUser = await getApiUser();
    if (!apiUser) {
      return NextResponse.json(
        { success: false, error: '認証されていません。ログインしてください。' },
        { status: 401 }
      );
    }

    // sender は必ずセッションから確定する(auth.ts が member_id を session.user.id に格納)
    const targetSenderId = apiUser.memberId;

    // 3. リクエストボディに型を適用
    const bodyData = (await request.json()) as SendNotificationBody;

    const { sheets, spreadsheetId } = getSheetsClient();


    // 宛先 (recipient_id) の取得
    const rawRecipient = bodyData.recipient_id || bodyData.recipientId || 'all';

    // 権限ルール: 一般会員が送れる宛先は「事務局(admin)」のみ。
    // 全会員 / グループ / 個人宛ては admin 専用(会員が全員へ一斉送信できてしまうのを防ぐ)。
    if (rawRecipient !== 'admin' && apiUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '一般会員が送信できる宛先は事務局のみです' },
        { status: 403 }
      );
    }



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

    const fcmTokenIdx = uHeaders.findIndex((h) => h === 'fcm_token');

    if (memberIdIdx === -1) memberIdIdx = 0; // A列
    if (userNameIdx === -1) userNameIdx = 1; // B列
    if (roleIdx === -1) roleIdx = 4;        // E列 (role)
    if (statusIdx === -1) statusIdx = 5;      // F列 (status)

    const userRows = uRows.slice(1);

    // ユーザー情報の構造化マップ（ID -> User, Name -> User）
    const userMapByMemberId = new Map<string, { memberId: string; name: string; role: string; isActive: boolean }>();
    const userMapByName = new Map<string, { memberId: string; name: string; role: string; isActive: boolean }>();
    //member_idとFCMトークンの対応
    const fcmTokenByMemberId = new Map<string, string>();

    userRows.forEach((row) => {
      const mId = row[memberIdIdx]?.toString().trim() || '';
      const uName = row[userNameIdx]?.toString().trim() || '';
      const role = row[roleIdx]?.toString().trim().toLowerCase() || '';
      const status = row[statusIdx]?.toString().trim().toLowerCase() || '';
      const isActive = status === 'active' || status === '有効';
      const fcmToken = fcmTokenIdx !== -1 ? row[fcmTokenIdx]?.toString().trim() || '' : '';

      if (mId) {
        const userInfo = { memberId: mId, name: uName, role, isActive };
        userMapByMemberId.set(mId, userInfo);
        if (uName) userMapByName.set(uName, userInfo);
        if (fcmToken) {
        fcmTokenByMemberId.set(mId, fcmToken);
        }
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

// ----------------------------------------------------
// 8. FCMプッシュ通知
// メッセージ保存とは独立させ、通知失敗で既存の送信処理を失敗させない
// ----------------------------------------------------
try {
  let pushTargetMemberIds: string[];
  if (rawRecipient === 'admin') {
    // Messages上は従来どおり recipient_id = "admin" の1件として保存。
    // Pushだけは active な管理者端末へ送信する。
    pushTargetMemberIds = Array.from(userMapByMemberId.values())
      .filter((user) => user.role === 'admin' && user.isActive)
      .map((user) => user.memberId);
  } else {
    pushTargetMemberIds = targetMemberIds;
  }

  const tokens = Array.from(
    new Set( pushTargetMemberIds
        .map((memberId) => fcmTokenByMemberId.get(memberId))
        .filter((token): token is string => Boolean(token))
    )
  );

  if (tokens.length > 0) {
    const messaging = getFirebaseAdminMessaging();
    // Firebase Admin SDKでは1回につき最大500件なので分割する
    for (let i = 0; i < tokens.length; i += 500) {
      const tokenChunk = tokens.slice(i, i + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: tokenChunk,
        data: {
          title: bodyData.title || '新着メッセージ',
          body: bodyData.body || '',
          url: bodyData.url || '/messages',
        },
      });

      if (response.failureCount > 0) {
        console.warn(
          `FCM通知: ${response.successCount}件成功 / ${response.failureCount}件失敗`
        );
      }
    }
  } else {
    console.log('FCM通知対象のトークンがありません');
  }
} catch (notificationError) {
  // Push通知が失敗してもMessages保存は成功扱いにする
  console.error('FCM通知送信エラー:', notificationError);
}
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