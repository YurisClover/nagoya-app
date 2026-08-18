import "server-only";

export const MEMBER_ID_PLACEHOLDER =
  "__MEMBER_ID__";

type PrefillScriptResponse = {
  success?: boolean;
  templateUrl?: string;
  placeholder?: string;
  sheetName?: string;
  sheetId?: number;
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
        action:"createPrefill",
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
      MEMBER_ID_PLACEHOLDER,
    )
  ) {
    throw new Error(
      "事前入力URLに会員ID置換用の値が含まれていません。",
    );
  }

  return result.templateUrl;
}

type ConfigureResponseSheetInput = {
  formId: string;
  eventId: string;
  eventTitle: string;
};

export type ConfigureResponseSheetResult = {
  sheetName: string;
  sheetId: number;
};

/**
 * Eventsシートへの保存後、
 * 回答タブ名と判定列を設定する。
 */
export async function configureGoogleFormResponseSheet({
  formId,
  eventId,
  eventTitle,
}: ConfigureResponseSheetInput):
Promise<ConfigureResponseSheetResult> {
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

  const response =
    await fetch(
      scriptUrl,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          action:
            "configureResponseSheet",

          secret,

          formId:
            formId.trim(),

          eventId:
            eventId.trim(),

          eventTitle:
            eventTitle.trim(),
        }),

        cache: "no-store",
      },
    );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `回答タブ設定APIエラー（${response.status}）：${
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
      "回答タブ設定APIから不正なレスポンスが返されました。",
    );
  }

  if (
    !result.success ||
    !result.sheetName
  ) {
    throw new Error(
      result.error ||
        "回答タブを設定できませんでした。",
    );
  }
  if (
  typeof result.sheetId !==
  "number"
) {
  throw new Error(
    "回答タブIDを取得できませんでした。",
  );
}

return {
  sheetName:result.sheetName,
  sheetId:result.sheetId,
};
}