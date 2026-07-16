import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { readFileSync } from 'fs';
import path from 'path';

const SPREADSHEET_KEY = '1zc3Bs31h0uIm7rhiWXtyV2vaor9lIGrO9PtVTXv0ZIs';

export async function GET() {
  try {
    // 💡 プロジェクトルート（直下）の config.json を安全に読み込む
    const filePath = path.join(process.cwd(), 'config.json');
    const fileContent = readFileSync(filePath, 'utf-8');
    const creds = JSON.parse(fileContent);

    const serviceAccountAuth = new JWT({
      email: creds.client_email,
      key: creds.private_key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SPREADSHEET_KEY, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const events = rows.map((row, index) => ({
      id: index,
      title: row.get('title') || 'タイトル未設定',
      event_date: row.get('event_date') || '日時未設定',
      form_url: row.get('form_url') || '#'
    }));

    return NextResponse.json(events);
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}