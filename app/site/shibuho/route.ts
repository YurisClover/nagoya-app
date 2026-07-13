//取得したデータをJSON形式に変更する
import { NextResponse } from 'next/server';
//Googleサービスへアクセスする権限
import { google } from 'googleapis';

//認証に必要な情報をauthに格納する
export async function GET() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.CLIENT_EMAIL,
      private_key: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    //閲覧のみの権限の付与
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

//バージョン3のルールでauthの情報を使うdrive（コントローラー）
  const drive = google.drive({ version: 'v3', auth });
//PDFが格納されているフォルダの場所の情報
  const folderId = process.env.DRIVE_FOLDER_ID;

//通信に失敗したときは下のエラー処理に流す
  try {
//Googleからデータが返ってくるまで次の行に進まない
    const response = await drive.files.list({
//指定したフォルダの中身で、ごみ箱に入っていないかつ、PDFファイルのみを検索する
      q: `'${folderId}' in parents and trashed = false and mimeType = 'application/pdf'`,
//取得するデータの絞り込み
      fields: 'files(id, name, createdTime)',
//新しい順に並び替え
      orderBy: 'createdTime desc',
    });

//PDFファイル一覧の配列（リスト）または空のリストをjsonにしてブラウザへ渡す
    return NextResponse.json(response.data.files || []);
//コンソールにエラーの原因を出力、ブラウザ側のエラー時の処理   
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '一覧の取得に失敗しました' }, { status: 500 });
  }
}