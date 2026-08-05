import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const TOKEN_VERSION = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const FUTURE_TOLERANCE_MS =
  5 * 60 * 1000;

export type EventApplyTokenPayload = {
  eventId: string;
  memberId: string;
  issuedAt: number;
};

type VerifyEventApplyTokenOptions = {
  /**
   * 指定した場合のみ、
   * 発行からの経過時間を検証する。
   *
   * 回答編集などで古い回答を
   * 再判定する可能性があるため、
   * 初期値では有効期限を設けない。
   */
  maxAgeMs?: number;
};

function getEncryptionKey(): Buffer {
  const secret =
    process.env
      .EVENT_APPLY_TOKEN_SECRET
      ?.trim();

  if (!secret) {
    throw new Error(
      "EVENT_APPLY_TOKEN_SECRETが設定されていません。",
    );
  }

  /*
   * 環境変数の長さにかかわらず、
   * AES-256で使用できる32byteの鍵にする。
   */
  return createHash("sha256")
    .update(secret, "utf8")
    .digest();
}

function encodeBase64Url(
  value: Buffer,
): string {
  return value.toString("base64url");
}

function decodeBase64Url(
  value: string,
): Buffer {
  return Buffer.from(
    value,
    "base64url",
  );
}

function normalizeRequiredValue(
  value: string,
  name: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      `${name}が空です。`,
    );
  }

  return normalized;
}

/**
 * Googleフォームへ埋め込む
 * 暗号化済み申込確認コードを作る。
 */
export function createEventApplyToken({
  eventId,
  memberId,
}: {
  eventId: string;
  memberId: string;
}): string {
  const payload: EventApplyTokenPayload =
    {
      eventId:
        normalizeRequiredValue(
          eventId,
          "eventId",
        ),

      memberId:
        normalizeRequiredValue(
          memberId,
          "memberId",
        ),

      issuedAt: Date.now(),
    };

  const iv =
    randomBytes(IV_LENGTH);

  const cipher =
    createCipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      iv,
    );

  /*
   * バージョン文字列も認証対象にする。
   */
  cipher.setAAD(
    Buffer.from(
      TOKEN_VERSION,
      "utf8",
    ),
  );

  const encrypted =
    Buffer.concat([
      cipher.update(
        JSON.stringify(payload),
        "utf8",
      ),
      cipher.final(),
    ]);

  const authTag =
    cipher.getAuthTag();

  return [
    TOKEN_VERSION,
    encodeBase64Url(iv),
    encodeBase64Url(authTag),
    encodeBase64Url(encrypted),
  ].join(".");
}

/**
 * 申込確認コードを復号・検証する。
 *
 * 改ざん・形式不正・復号失敗時は
 * nullを返す。
 */
export function verifyEventApplyToken(
  token: string,
  options: VerifyEventApplyTokenOptions =
    {},
): EventApplyTokenPayload | null {
  try {
    const [
      version,
      encodedIv,
      encodedAuthTag,
      encodedEncrypted,
    ] = token.trim().split(".");

    if (
      version !== TOKEN_VERSION ||
      !encodedIv ||
      !encodedAuthTag ||
      !encodedEncrypted
    ) {
      return null;
    }

    const iv =
      decodeBase64Url(encodedIv);

    const authTag =
      decodeBase64Url(
        encodedAuthTag,
      );

    const encrypted =
      decodeBase64Url(
        encodedEncrypted,
      );

    if (
      iv.length !== IV_LENGTH ||
      authTag.length !==
        AUTH_TAG_LENGTH ||
      encrypted.length === 0
    ) {
      return null;
    }

    const decipher =
      createDecipheriv(
        "aes-256-gcm",
        getEncryptionKey(),
        iv,
      );

    decipher.setAAD(
      Buffer.from(
        TOKEN_VERSION,
        "utf8",
      ),
    );

    decipher.setAuthTag(
      authTag,
    );

    const decrypted =
      Buffer.concat([
        decipher.update(
          encrypted,
        ),
        decipher.final(),
      ]);

    const parsed: unknown =
      JSON.parse(
        decrypted.toString(
          "utf8",
        ),
      );

    if (
      typeof parsed !== "object" ||
      parsed === null
    ) {
      return null;
    }

    const candidate =
      parsed as Partial<EventApplyTokenPayload>;

    if (
      typeof candidate.eventId !==
        "string" ||
      !candidate.eventId.trim() ||
      typeof candidate.memberId !==
        "string" ||
      !candidate.memberId.trim() ||
      typeof candidate.issuedAt !==
        "number" ||
      !Number.isFinite(
        candidate.issuedAt,
      )
    ) {
      return null;
    }

    const now =
      Date.now();

    /*
     * 未来の日時を持つコードは無効。
     * 端末・サーバー時刻の軽微なずれだけ許容する。
     */
    if (
      candidate.issuedAt >
      now + FUTURE_TOLERANCE_MS
    ) {
      return null;
    }

    if (
      options.maxAgeMs !==
        undefined &&
      (
        !Number.isFinite(
          options.maxAgeMs,
        ) ||
        options.maxAgeMs < 0 ||
        now - candidate.issuedAt >
          options.maxAgeMs
      )
    ) {
      return null;
    }

    return {
      eventId:
        candidate.eventId.trim(),

      memberId:
        candidate.memberId.trim(),

      issuedAt:
        candidate.issuedAt,
    };
  } catch {
    return null;
  }
}