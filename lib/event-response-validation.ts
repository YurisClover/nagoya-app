import "server-only";
import { verifyEventApplyToken,} from "@/lib/event-apply-token";

/**
 * Googleフォーム上の質問名。
 * 実際の質問名と完全に一致させる。
 */
export const APPLY_TOKEN_HEADER =
  "会員ID申込確認コード";

export type EventResponseValidationResult =
  | {
      valid: true;
      eventId: string;
      memberId: string;
      error: "";
    }
  | {
      valid: false;
      eventId: string | null;
      memberId: null;
      error: string;
    };

/**
 * フォーム回答に含まれる申込確認コードを検証する。
 *
 * この段階では、
 * ・コードが存在するか
 * ・改ざんされていないか
 * ・回答対象のイベントと一致するか
 *
 * を確認する。
 *
 * 会員がUsersシートに存在するかは、
 * 次の同期処理で確認する。
 */
export function validateEventResponseToken({
  token,
  expectedEventId,
}: {
  token: unknown;
  expectedEventId: string;
}): EventResponseValidationResult {
  const normalizedToken = String(token ?? "").trim();
  const normalizedEventId = expectedEventId.trim();

  if (!normalizedToken) {
    return {
      valid: false,
      eventId: null,
      memberId: null,
      error:
        "申込確認コードがありません",
    };
  }

  if (!normalizedEventId) {
    return {
      valid: false,
      eventId: null,
      memberId: null,
      error:
        "イベントIDがありません",
    };
  }

  const payload = verifyEventApplyToken( normalizedToken, );

  if (!payload) {
    return {
      valid: false,
      eventId: null,
      memberId: null,
      error:
        "申込確認コードが不正です",
    };
  }

  if (payload.eventId !== normalizedEventId ) {
    return {
      valid: false,
      eventId:
        payload.eventId,
      memberId: null,
      error:
        "イベントが一致しません",
    };
  }

  return {
    valid: true,
    eventId:payload.eventId,
    memberId:payload.memberId,
    error: "",
  };
}