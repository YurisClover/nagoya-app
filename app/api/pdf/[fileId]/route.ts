import { NextRequest } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

// [fileId]部分の文字を自動的に受け取りparams（fileIdの文字列）に詰める
export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  // 分割代入を行い、await params を使って、fileId を取得しfileIdを代入
  const { fileId } = await params;

  //ファイルidが入っていなかった場合のreturnの処理
  if (!fileId) {
    return new Response('ファイルIDが指定されていません', { status: 400 });
  }

//認証に必要な情報をauthに格納する
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.CLIENT_EMAIL,
      private_key: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

//バージョン3のルールでauthの情報を使うdrive（コントローラー）
  const drive = google.drive({ version: 'v3', auth });

  //通信に失敗したときは下の処理に進む
  try {
    //googleからPDFファイルの情報が返ってくるまで待って、pdfResponseに格納する
    const pdfResponse = await drive.files.get(
      //中身が必要なPDFファイルの指定とファイルの中身を取得する処理
      { fileId: fileId, alt: 'media' },
      //ストリーム形式で受けとる
      { responseType: 'stream' }
    );

    //node.jsのストリーム型からweb標準ストリーム型に変換する
    const nodeStream = pdfResponse.data as Readable; 
    const webStream = Readable.toWeb(nodeStream);

    //web標準ストリームが受け取れる形にして、ブラウザ側へPDFの情報を渡す
    return new Response(webStream as unknown as ReadableStream, {
      //PDFのデータであることを指定する
      headers: { 'Content-Type': 'application/pdf' },
    });
    
    //コンソールにエラーの原因を出力、ブラウザ側のエラー時の処理   
  } catch (error) {
    console.error(error);
    return new Response('PDFの取得に失敗しました', { status: 500 });
  }
}