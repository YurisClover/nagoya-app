import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

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

    let targetMemberIds: string[] = [];
    let isGroupMatch = false;

    // 3. グループ指定の判定 (Groupsシートを確認)
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

          // カンマ（半角・全角）で分割し、トリム＆空文字除去
          targetMemberIds = rawMemberIdsStr
            .split(/[,，、]/)
            .map((id: string) => id.trim())
            .filter((id: string) => id.length > 0);
        }
      }
    } catch (gErr) {
      console.warn('Groupsシートの確認をスキップしました:', gErr);
    }

    // 4. グループ指定でなかった場合 (全体指定 'all' または 個別指定)
    if (!isGroupMatch) {
      const usersRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Users!A:Z',
      });

      const rows = usersRes.data.values || [];
      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Usersシートにデータが存在しません' },
          { status: 400 }
        );
      }

      const headers = rows[0].map((h: string) => h.toLowerCase().trim());
      let memberIdIdx = headers.findIndex((h) => h === 'member_id' || h === 'id');
      let userNameIdx = headers.findIndex((h) => h === 'user_name' || h === 'username' || h === 'name');

      if (memberIdIdx === -1) memberIdIdx = 0;
      if (userNameIdx === -1) userNameIdx = 1;

      const userRows = rows.slice(1);

      if (rawRecipient === 'all') {
        // 全体配信：Usersシートの全員の member_id
        targetMemberIds = userRows
          .map((row: string[]) => row[memberIdIdx]?.toString().trim())
          .filter((mId): mId is string => Boolean(mId));
      } else {
        // 個別配信：user_name または member_id から該当する member_id を特定
        const matchedUser = userRows.find((row) => {
          const mId = row[memberIdIdx]?.toString().trim();
          const uName = row[userNameIdx]?.toString().trim();
          return mId === rawRecipient || uName === rawRecipient;
        });

        if (matchedUser && matchedUser[memberIdIdx]) {
          targetMemberIds = [matchedUser[memberIdIdx].toString().trim()];
        } else {
          targetMemberIds = [rawRecipient];
        }
      }
    }

    if (targetMemberIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '対象のユーザー（member_id）が見つかりませんでした' },
        { status: 400 }
      );
    }

    const createdAt = new Date().toISOString();

    // 5. 対象メンバーそれぞれに対して1件ずつメッセージ行を作成
    const rowsToAppend = targetMemberIds.map((recipientMemberId) => [
      crypto.randomUUID(),  // A: message_id (UUID)
      targetSenderId,       // B: sender_id (送信者の member_id)
      recipientMemberId,    // C: recipient_id (受信者の member_id)
      bodyData.title,       // D: title
      bodyData.body,        // E: body
      'unread',             // F: is_read
      createdAt,            // G: created_at
    ]);

    // 6. Messagesシートに一括保存
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Messages!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rowsToAppend,
      },
    });

    return NextResponse.json({
      success: true,
      savedCount: rowsToAppend.length,
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