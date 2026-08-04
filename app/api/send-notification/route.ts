import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';
import dns from 'node:dns';
import { nowJST } from '@/lib/datetime';

// ローカル開発環境（npm run dev）の時だけ IPv4 を優先にし、デプロイ環境（IPv6-Only等）では設定しない
if (process.env.NODE_ENV === 'development') {
  dns.setDefaultResultOrder('ipv4first');
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
    const targetSenderId = (session.user as any).member_id || session.user.id;

    if (!targetSenderId) {
      return NextResponse.json(
        { success: false, error: '送信者の member_id がセッションから取得できませんでした' },
        { status: 400 }
      );
    }

    const bodyData = await request.json();

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

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

    // 3. Users シートを取得してアクティブなユーザーを把握
    const usersRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:Z',
    });

    const uRows = usersRes.data.values || [];
    if (uRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Usersシートにデータが存在しません' },
        { status: 400 }
      );
    }

    const uHeaders = uRows[0].map((h: string) => h.toLowerCase().trim());
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
    let isGroupMatch = false;

    // 4. グループ指定の判定 (Groupsシートを確認)
    try {
      const groupsRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Groups!A:Z',
      });
      const groupRows = groupsRes.data.values || [];

      if (groupRows.length > 1) {
        const gHeaders = groupRows[0].map((h: string) => h.toLowerCase().trim());
        let gIdIdx = gHeaders.findIndex((h) => h === 'group_id' || h === 'id');
        let gNameIdx = gHeaders.findIndex((h) => h === 'group_name' || h === 'name');
        let gMemberIdsIdx = gHeaders.findIndex((h) => h === 'member_ids' || h === 'member_id' || h === 'members');

        if (gIdIdx === -1) gIdIdx = 0;
        if (gNameIdx === -1) gNameIdx = 1;
        if (gMemberIdsIdx === -1) gMemberIdsIdx = 2;

        // 指定された group_id または group_name に一致する行を検索
        const matchedGroup = groupRows.slice(1).find((row) => {
          const gId = row[gIdIdx]?.toString().trim();
          const gName = row[gNameIdx]?.toString().trim();
          return gId === rawRecipient || gName === rawRecipient;
        });

        // グループが存在し、member_ids が設定されている場合
        if (matchedGroup && matchedGroup[gMemberIdsIdx]) {
          isGroupMatch = true;
          const rawMemberIdsStr = matchedGroup[gMemberIdsIdx].toString();

          // カンマ分割・整形し、送信者自身を除外 ＋ ★ Usersのstatusがactiveのユーザーのみ抽出
          targetMemberIds = rawMemberIdsStr
            .split(/[,，、]/)
            .map((id: string) => id.trim())
            .filter((id: string) => {
              if (!id || id === targetSenderId) return false;
              const user = userMapByMemberId.get(id);
              return user ? user.isActive : false; // statusがactiveのみ
            });
        }
      }
    } catch (gErr) {
      console.warn('Groupsシートの確認をスキップしました:', gErr);
    }

    // 5. グループ指定でなかった場合 (全体指定 'all' / 管理者指定 'admin' / 個別指定)
    if (!isGroupMatch) {
      if (rawRecipient === 'all') {
        // ★ 全体配信：送信者自身を除外 ＆ statusがactiveの全ユーザー
        targetMemberIds = Array.from(userMapByMemberId.values())
          .filter((user) => user.memberId !== targetSenderId && user.isActive)
          .map((user) => user.memberId);

      } else if (rawRecipient === 'admin') {
        // ★ 管理者宛て：roleがadmin かつ statusがactiveのユーザー
        targetMemberIds = Array.from(userMapByMemberId.values())
          .filter((user) => user.memberId !== targetSenderId && user.role === 'admin' && user.isActive)
          .map((user) => user.memberId);

        if (targetMemberIds.length === 0) {
          return NextResponse.json(
            { success: false, error: 'アクティブな管理者ユーザー（member_id）が見つかりませんでした。' },
            { status: 400 }
          );
        }

      } else {
        // ★ 個別配信：member_id または user_name から指定されたユーザーを特定
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

        // 個別指定されたユーザーが非アクティブ（inactive）の場合
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
    }

    // 重複IDの除去
    targetMemberIds = Array.from(new Set(targetMemberIds));

    // 保存日時は JST 形式 (+09:00付き) で生成
    const createdAt = nowJST();

    // 6. 対象メンバーそれぞれに対して1件ずつメッセージ行を作成
    const rowsToAppend = targetMemberIds.map((recipientMemberId) => {
      // ★ 送信者と受信者が同じ（自分宛て）の場合は、最初から既読（'true'）にする
      const isRead = String(targetSenderId).trim() === String(recipientMemberId).trim() ? 'true' : 'false';

      return [
        crypto.randomUUID(),   // A: message_id (UUID)
        targetSenderId,        // B: sender_id (送信者の member_id)
        recipientMemberId,     // C: recipient_id (受信者の member_id)
        bodyData.title,        // D: title
        bodyData.body,         // E: body
        isRead,                // F: is_read (自分宛てなら 'true', それ以外は 'false')
        createdAt,             // G: created_at (nowJST())
        'false',               // H: delete_flag (デフォルトは 'false')
      ];
    });

    // 7. Messagesシートに一括保存
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Messages!A:H',
      valueInputOption: 'RAW', 
      requestBody: {
        values: rowsToAppend,
      },
    });

    return NextResponse.json({
      success: true,
      savedCount: rowsToAppend.length,       // 実際に送信が成功した件数
      totalCount: targetMemberIds.length,     // 送信対象の全件数
      sender_id: targetSenderId,
      target_members: targetMemberIds,
    });
  } catch (error: any) {
    console.error('【送信時のエラー詳細】:', error);
    return NextResponse.json(
      { success: false, error: error.message || '送信中にエラーが発生しました' },
      { status: 500 }
    );
  }
}