import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// 1. ファイルのパスを明示的に特定する
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'serviceAccountKey.json');

console.log("📂 読み込みに行こうとしている場所:", filePath);

try {
  // 同期的に読み込んで即座に確認する
  const content = readFileSync(filePath, 'utf8');
  console.log("📄 ファイルの中身（先頭50文字）:", content.substring(0, 50));
  
  const serviceAccount = JSON.parse(content);
  console.log("✅ JSONパース成功。Project ID:", serviceAccount.project_id);

  // 2. 初期化
  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
} catch (e) {
  console.error("❌ エラー発生:", e.message);
  process.exit(1); // ここで止める
}

// 3. 実行
async function testPush() {
  const messaging = getMessaging();
  // ブラウザで取得した最新のトークン（毎回必ず最新のものを貼ってください）
  const registrationToken = 'cF5_U1Tl2I9yADG4uSKD4l:APA91bEZf7JRfJTUFxU78O5ZtZXDs9miiBjms-VuNco57ebRA-3dMUOZUhy70FKTJ_C5bY3YEaIJ-KRhhAULrBJqM57fLxdIuh4y_0nLhXHPoUq-kFdTd8I'
  console.log("🚀 送信開始...");
  try {
    const response = await messaging.send({
      token: registrationToken,
      notification: { title: 'テスト通知', body: '成功！' }
    });
    console.log('✅ 送信成功:', response);
  } catch (error) {
    console.error('❌ 送信失敗:', error.message);
  }
}

testPush();