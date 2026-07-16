// ここに通知のロジックをすべて詰め込みます
const admin = require('firebase-admin');

// 通知送信＋無効トークン削除の機能
export const sendEventNotification = async (tokens, title, body) => {
  // 500個ずつのバッチ処理など、ここに必要なロジックを書く
  // 失敗した時にDBから削除する処理もここに記述
  try {
     // 送信処理...
  } catch (error) {
     // エラーコードを見て、無効トークンならDB削除処理を呼ぶ
  }
};