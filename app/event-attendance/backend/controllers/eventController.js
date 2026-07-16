import { sendEventNotification } from '../services/notificationService';

// イベント作成処理の関数
export const createEvent = async (req, res) => {
  // 1. DBにイベント保存する処理
  await saveToDb(req.body);

  // 2. 「通知を送る」という関数を呼ぶだけ（あなたの作った機能！）
  const tokens = await getTokensFromDb(); // DBからトークン取得
  await sendEventNotification(tokens, "新しいイベント", "イベントが作られました！");
  
  res.send("作成成功！");
};