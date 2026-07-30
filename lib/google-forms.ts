import { forms_v1,google } from "googleapis";
import {createAuthenticatedGoogleFormsOAuthClient,} from "@/lib/google-auth";

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

/**
 * Googleフォームの公開・回答受付状態を変更する
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

  const auth =
    createAuthenticatedGoogleFormsOAuthClient();

  const forms = google.forms({
    version: "v1",
    auth,
  });

  const publishState =
    FORM_STATUS_SETTINGS[status];

  const response =
    await forms.forms.setPublishSettings({
      formId,

      requestBody: {
        publishSettings: {
          publishState,
        },
        updateMask: "publishState",
      },
    });

  return response.data;
}

export type EventFormQuestionType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "RADIO";

export type EventFormQuestion = {
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

/**
 * 管理画面から受け取った質問情報を、
 * Google Forms APIの質問追加リクエストへ変換する。
 */
function createQuestionRequest(
  question: EventFormQuestion,
  index: number,
): forms_v1.Schema$Request {
  if (!question.title.trim()) {
    throw new Error(
      `${index + 1}問目の質問タイトルが空です。`,
    );
  }

  if (question.type === "RADIO") {
    if (
      !question.options ||
      question.options.length < 2
    ) {
      throw new Error(
        `${question.title}には2つ以上の選択肢が必要です。`,
      );
    }

    return {
      createItem: {
        item: {
          title: question.title,
          description: question.description,

          questionItem: {
            question: {
              required: question.required,

              choiceQuestion: {
                type: "RADIO",
                options: question.options.map(
                  (option) => ({
                    value: option,
                  }),
                ),
                shuffle: false,
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
        title: question.title,
        description: question.description,

        questionItem: {
          question: {
            required: question.required,

            textQuestion: {
              paragraph:
                question.type === "LONG_TEXT",
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
 * イベント用Googleフォームを非公開状態で作成する。
 */
export async function createEventGoogleForm(
  input: CreateEventGoogleFormInput,
): Promise<CreatedEventGoogleForm> {
  if (!input.title.trim()) {
    throw new Error(
      "フォームタイトルが入力されていません。",
    );
  }

  const auth =
    createAuthenticatedGoogleFormsOAuthClient();

  const forms = google.forms({
    version: "v1",
    auth,
  });

  /*
   * ① タイトルだけの空フォームを非公開で作成
   */
  const createResponse =
    await forms.forms.create({
      unpublished: true,

      requestBody: {
        info: {
          title: input.title,
          documentTitle: input.title,
        },
      },
    });

  const formId = createResponse.data.formId;

  if (!formId) {
    throw new Error(
      "作成したGoogleフォームのIDを取得できませんでした。",
    );
  }

  /*
   * ② 説明文と質問を追加
   */
  const requests: forms_v1.Schema$Request[] =
    [];

  if (input.description?.trim()) {
    requests.push({
      updateFormInfo: {
        info: {
          description: input.description,
        },
        updateMask: "description",
      },
    });
  }

  requests.push(
    ...input.questions.map(
      (question, index) =>
        createQuestionRequest(
          question,
          index,
        ),
    ),
  );

  if (requests.length > 0) {
    await forms.forms.batchUpdate({
      formId,

      requestBody: {
        requests,
      },
    });
  }

  return {
    formId,
    title: input.title,

    editUrl:
      `https://docs.google.com/forms/d/${formId}/edit`,

    responderUrl:
      createResponse.data.responderUri,

    isPublished: false,
    isAcceptingResponses: false,
  };
}