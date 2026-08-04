import "server-only";

export const APPLY_TOKEN_PLACEHOLDER =
  "__APPLY_TOKEN__";

type PrefillScriptResponse = {
  success?: boolean;
  templateUrl?: string;
  placeholder?: string;
  error?: string;
};

/**
 * Apps Scriptを呼び出し、
 * 会員ID事前入力用URLのひな型を取得する。
 */
export async function createGoogleFormPrefillTemplate(
  formId: string,
): Promise<string> {
  const scriptUrl =
    process.env
      .GOOGLE_FORM_PREFILL_SCRIPT_URL;

  const secret =
    process.env
      .GOOGLE_FORM_PREFILL_SECRET;

  if (!scriptUrl) {
    throw new Error(
      "GOOGLE_FORM_PREFILL_SCRIPT_URLが設定されていません。",
    );
  }

  if (!secret) {
    throw new Error(
      "GOOGLE_FORM_PREFILL_SECRETが設定されていません。",
    );
  }

  const normalizedFormId =
    formId.trim();

  if (!normalizedFormId) {
    throw new Error(
      "GoogleフォームIDが指定されていません。",
    );
  }

  const response = await fetch(
    scriptUrl,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        secret,
        formId:
          normalizedFormId,
      }),

      cache: "no-store",
    },
  );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `事前入力URL生成APIエラー（${response.status}）：${
        responseText ||
        response.statusText
      }`,
    );
  }

  let result:
    PrefillScriptResponse;

  try {
    result = JSON.parse(
      responseText,
    ) as PrefillScriptResponse;
  } catch {
    throw new Error(
      "事前入力URL生成APIから不正なレスポンスが返されました。",
    );
  }

  if (
    !result.success ||
    !result.templateUrl
  ) {
    throw new Error(
      result.error ||
        "事前入力URLのひな型を取得できませんでした。",
    );
  }

  if (
    !result.templateUrl.includes(
      APPLY_TOKEN_PLACEHOLDER,
    )
  ) {
    throw new Error(
      "事前入力URLに申込確認コード置換用の値が含まれていません。",
    );
  }

  return result.templateUrl;
}

