import "server-only";

import {
  createAuthenticatedGoogleFormsOAuthClient,
} from "@/lib/google-auth";

export type GoogleFormStatus =
  | "private"
  | "open"
  | "closed";

const FORM_STATUS_SETTINGS = {
  private: {
    isPublished: false,
    isAcceptingResponses: false,
  },

  open: {
    isPublished: true,
    isAcceptingResponses: true,
  },

  closed: {
    isPublished: true,
    isAcceptingResponses: false,
  },
} as const;

export type EventFormQuestionType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "RADIO";

export type EventFormQuestion = {
  /*
   * システムで質問を識別したい場合に指定する。
   * 会員ID質問ではmemberIdを使用する。
   */
  questionId?: string;

  title: string;
  description?: string;
  required: boolean;
  type: EventFormQuestionType;
  options?: string[];
};

export type CreateEventGoogleFormInput = {
  title: string;
  description?: string;
  questions: EventFormQuestion[];
};

export type CreatedEventGoogleForm = {
  formId: string;
  title: string;
  editUrl: string;
  responderUrl?: string | null;
  isPublished: false;
  isAcceptingResponses: false;
};

type GoogleFormsApiError = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type CreateFormResponse = {
  formId?: string;
  responderUri?: string | null;
};

type FormsApiRequest = {
  updateFormInfo?: {
    info: {
      description: string;
    };

    updateMask: string;
  };

  createItem?: {
    item: {
      title: string;
      description?: string;

      questionItem: {
        question: {
          questionId?: string;
          required: boolean;

          textQuestion?: {
            paragraph: boolean;
          };

          choiceQuestion?: {
            type: "RADIO";

            options: Array<{
              value: string;
            }>;

            shuffle: boolean;
          };
        };
      };
    };

    location: {
      index: number;
    };
  };
};

/**
 * OAuthアクセストークンを取得する。
 */
async function getGoogleFormsAccessToken():
Promise<string> {
  const auth =
    createAuthenticatedGoogleFormsOAuthClient();

  const accessTokenResponse =
    await auth.getAccessToken();

  const accessToken =
    accessTokenResponse.token;

  if (!accessToken) {
    throw new Error(
      "Google Forms APIのアクセストークンを取得できませんでした。",
    );
  }

  return accessToken;
}

/**
 * Google Forms REST APIへリクエストを送る。
 */
async function requestGoogleFormsApi<T>(
  url: string,
  accessToken: string,
  init: RequestInit,
): Promise<T> {
  const response =
    await fetch(
      url,
      {
        ...init,

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",

          ...(init.headers ?? {}),
        },

        cache: "no-store",
      },
    );

  const responseText =
    await response.text();

  if (!response.ok) {
    let detail =
      responseText ||
      response.statusText;

    if (responseText) {
      try {
        const parsedError =
          JSON.parse(
            responseText,
          ) as GoogleFormsApiError;

        detail =
          parsedError.error?.message ??
          detail;
      } catch {
        // JSON形式でない場合は、
        // 元のレスポンス文字列を使用する。
      }
    }

    throw new Error(
      `Google Forms APIエラー (${response.status}): ${detail}`,
    );
  }

  if (!responseText) {
    return {} as T;
  }

  return JSON.parse(
    responseText,
  ) as T;
}

/**
 * 管理画面から受け取った質問情報を、
 * Google Forms APIの質問追加リクエストへ変換する。
 */
function createQuestionRequest(
  question: EventFormQuestion,
  index: number,
): FormsApiRequest {
  const title =
    question.title.trim();

  if (!title) {
    throw new Error(
      `${index + 1}問目の質問タイトルが空です。`,
    );
  }

  const questionId =
    question.questionId?.trim();

  if (
    question.questionId !==
      undefined &&
    !questionId
  ) {
    throw new Error(
      `${title}の質問IDが空です。`,
    );
  }

  if (
    question.type ===
    "RADIO"
  ) {
    const options =
      question.options
        ?.map(
          (option) =>
            option.trim(),
        )
        .filter(Boolean);

    if (
      !options ||
      options.length < 2
    ) {
      throw new Error(
        `${title}には2つ以上の選択肢が必要です。`,
      );
    }

    return {
      createItem: {
        item: {
          title,

          description:
            question.description,

          questionItem: {
            question: {
              questionId,
              required:
                question.required,

              choiceQuestion: {
                type:
                  "RADIO",

                options:
                  options.map(
                    (option) => ({
                      value:
                        option,
                    }),
                  ),

                shuffle:
                  false,
              },
            },
          },
        },

        location: {
          index,
        },
      },
    };
  }

  return {
    createItem: {
      item: {
        title,

        description:
          question.description,

        questionItem: {
          question: {
            questionId,

            required:
              question.required,

            textQuestion: {
              paragraph:
                question.type ===
                "LONG_TEXT",
            },
          },
        },
      },

      location: {
        index,
      },
    },
  };
}

/**
 * Googleフォームの公開・回答受付状態を変更する。
 *
 * 現在status APIが別の軽量ファイルを使っていても、
 * 既存importとの互換性のため残している。
 */
export async function setGoogleFormStatus(
  formId: string,
  status: GoogleFormStatus,
) {
  if (!formId) {
    throw new Error(
      "GoogleフォームIDが指定されていません。",
    );
  }

  const accessToken =
    await getGoogleFormsAccessToken();

  const publishState =
    FORM_STATUS_SETTINGS[
      status
    ];

  return requestGoogleFormsApi<{
    formId?: string;
  }>(
    `https://forms.googleapis.com/v1/forms/${encodeURIComponent(
      formId,
    )}:setPublishSettings`,

    accessToken,

    {
      method: "POST",

      body: JSON.stringify({
        publishSettings: {
          publishState,
        },

        updateMask:
          "publishState",
      }),
    },
  );
}

/**
 * イベント用Googleフォームを非公開状態で作成する。
 */
export async function createEventGoogleForm(
  input: CreateEventGoogleFormInput,
): Promise<CreatedEventGoogleForm> {
  const title =
    input.title.trim();

  if (!title) {
    throw new Error(
      "フォームタイトルが入力されていません。",
    );
  }

  const accessToken =
    await getGoogleFormsAccessToken();

  /*
   * ① タイトルだけの空フォームを
   * 非公開状態で作成する。
   */
  const createResponse =
    await requestGoogleFormsApi<CreateFormResponse>(
      "https://forms.googleapis.com/v1/forms?unpublished=true",

      accessToken,

      {
        method: "POST",

        body: JSON.stringify({
          info: {
            title,

            documentTitle:
              title,
          },
        }),
      },
    );

  const formId =
    createResponse.formId;

  if (!formId) {
    throw new Error(
      "作成したGoogleフォームのIDを取得できませんでした。",
    );
  }

  /*
   * ② 説明文と質問を追加する。
   */
  const requests:
    FormsApiRequest[] = [];

  if (
    input.description?.trim()
  ) {
    requests.push({
      updateFormInfo: {
        info: {
          description:
            input.description,
        },

        updateMask:
          "description",
      },
    });
  }

  requests.push(
    ...input.questions.map(
      (
        question,
        index,
      ) =>
        createQuestionRequest(
          question,
          index,
        ),
    ),
  );

  if (
    requests.length > 0
  ) {
    await requestGoogleFormsApi(
      `https://forms.googleapis.com/v1/forms/${encodeURIComponent(
        formId,
      )}:batchUpdate`,

      accessToken,

      {
        method: "POST",

        body: JSON.stringify({
          requests,
        }),
      },
    );
  }

  return {
    formId,
    title,

    editUrl:
      `https://docs.google.com/forms/d/${formId}/edit`,

    responderUrl:
      createResponse.responderUri,

    isPublished:
      false,

    isAcceptingResponses:
      false,
  };
}