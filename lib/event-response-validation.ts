import "server-only";

/**
 * Googleフォーム上の質問名。
 * 実際の質問名と完全に一致させる。
 */
export const APPLY_TOKEN_HEADER =
  "会員ID";

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
 * フォーム回答に含まれる会員IDを確認する。
 *
 * 暗号化・復号は行わず、
 * 回答された値をそのまま会員IDとして扱う。
 *
 * Usersシートに会員が存在するかは、
 * 次の同期処理で確認する。
 */
export function validateEventResponseToken({
  token,
  expectedEventId,
}: {
  token: unknown;
  expectedEventId: string;
}): EventResponseValidationResult {
  const memberId =
    String(
      token ?? "",
    ).trim();

  const normalizedEventId =
    expectedEventId.trim();

  if (!memberId) {
    return {
      valid: false,
      eventId:
        normalizedEventId ||
        null,
      memberId: null,
      error:
        "会員IDがありません",
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

  return {
    valid: true,
    eventId:
      normalizedEventId,
    memberId,
    error: "",
  };
}