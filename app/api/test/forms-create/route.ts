// // import { google } from "googleapis";
// // import { NextResponse } from "next/server";
// // import {
// //   createAuthenticatedGoogleFormsOAuthClient,
// // } from "@/lib/google-auth";

// // export async function GET() {
// //   try {
// //     const auth =
// //       createAuthenticatedGoogleFormsOAuthClient();

// //     const forms = google.forms({
// //       version: "v1",
// //       auth,
// //     });

// //     // 非公開・回答受付停止の状態でフォームを作成
// //     const createResponse =
// //       await forms.forms.create({
// //         unpublished: true,

// //         requestBody: {
// //           info: {
// //             title: "OAuthフォーム作成テスト",
// //             documentTitle:
// //               "OAuthフォーム作成テスト",
// //           },
// //         },
// //       });

// //     const formId =
// //       createResponse.data.formId;

// //     if (!formId) {
// //       throw new Error(
// //         "作成したGoogleフォームのIDを取得できませんでした。",
// //       );
// //     }

// //     return NextResponse.json({
// //       success: true,
// //       message:
// //         "Googleフォームを非公開状態で作成しました。",
// //       form: {
// //         formId,
// //         title:
// //           createResponse.data.info?.title,
// //         editUrl:
// //           `https://docs.google.com/forms/d/${formId}/edit`,
// //         responderUrl:
// //           createResponse.data.responderUri,
// //         status: {
// //           isPublished: false,
// //           isAcceptingResponses: false,
// //         },
// //       },
// //     });
// //   } catch (error) {
// //     console.error(
// //       "Google Forms creation error:",
// //       error,
// //     );

// //     const detail =
// //       error instanceof Error
// //         ? error.message
// //         : "不明なエラーが発生しました。";

// //     return NextResponse.json(
// //       {
// //         success: false,
// //         error:
// //           "Googleフォームの作成に失敗しました。",
// //         detail,
// //       },
// //       { status: 500 },
// //     );
// //   }
// // }

// import { google } from "googleapis";
// import { NextResponse } from "next/server";
// import {
//   createAuthenticatedGoogleFormsOAuthClient,
// } from "@/lib/google-auth";

// export async function GET() {
//   try {
//     const auth =
//       createAuthenticatedGoogleFormsOAuthClient();

//     const forms = google.forms({
//       version: "v1",
//       auth,
//     });

//     /*
//      * ① 空のGoogleフォームを非公開状態で作成
//      */
//     const createResponse =
//       await forms.forms.create({
//         unpublished: true,

//         requestBody: {
//           info: {
//             title: "イベント申込フォームテスト",
//             documentTitle:
//               "イベント申込フォームテスト",
//           },
//         },
//       });

//     const formId = createResponse.data.formId;

//     if (!formId) {
//       throw new Error(
//         "作成したGoogleフォームのIDを取得できませんでした。",
//       );
//     }

//     /*
//      * ② 作成したフォームへ質問を追加
//      */
//     const updateResponse =
//       await forms.forms.batchUpdate({
//         formId,

//         requestBody: {
//           includeFormInResponse: true,

//           requests: [
//             /*
//              * 質問1：会員ID
//              * 短文回答・必須
//              */
//             {
//               createItem: {
//                 item: {
//                   title: "会員ID",

//                   description:
//                     "会員登録時に発行されたIDを入力してください。",

//                   questionItem: {
//                     question: {
//                       required: true,

//                       textQuestion: {
//                         paragraph: false,
//                       },
//                     },
//                   },
//                 },

//                 location: {
//                   index: 0,
//                 },
//               },
//             },

//             /*
//              * 質問2：参加区分
//              * ラジオボタン・必須
//              */
//             {
//               createItem: {
//                 item: {
//                   title: "参加区分",

//                   questionItem: {
//                     question: {
//                       required: true,

//                       choiceQuestion: {
//                         type: "RADIO",

//                         options: [
//                           {
//                             value: "参加する",
//                           },
//                           {
//                             value: "キャンセル待ちを希望する",
//                           },
//                         ],

//                         shuffle: false,
//                       },
//                     },
//                   },
//                 },

//                 location: {
//                   index: 1,
//                 },
//               },
//             },

//             /*
//              * 質問3：備考
//              * 長文回答・任意
//              */
//             {
//               createItem: {
//                 item: {
//                   title: "備考",

//                   description:
//                     "運営への連絡事項がある場合に入力してください。",

//                   questionItem: {
//                     question: {
//                       required: false,

//                       textQuestion: {
//                         paragraph: true,
//                       },
//                     },
//                   },
//                 },

//                 location: {
//                   index: 2,
//                 },
//               },
//             },
//           ],
//         },
//       });

//     const updatedForm =
//       updateResponse.data.form;

//     return NextResponse.json({
//       success: true,

//       message:
//         "質問付きGoogleフォームを非公開状態で作成しました。",

//       form: {
//         formId,

//         title:
//           updatedForm?.info?.title ??
//           createResponse.data.info?.title,

//         questionCount:
//           updatedForm?.items?.length ?? 0,

//         editUrl:
//           `https://docs.google.com/forms/d/${formId}/edit`,

//         responderUrl:
//           createResponse.data.responderUri,

//         status: {
//           isPublished: false,
//           isAcceptingResponses: false,
//         },
//       },
//     });
//   } catch (error) {
//     console.error(
//       "Google Forms creation error:",
//       error,
//     );

//     const detail =
//       error instanceof Error
//         ? error.message
//         : "不明なエラーが発生しました。";

//     return NextResponse.json(
//       {
//         success: false,
//         error:
//           "質問付きGoogleフォームの作成に失敗しました。",
//         detail,
//       },
//       {
//         status: 500,
//       },
//     );
//   }
// }
import { NextResponse } from "next/server";
import {
  createEventGoogleForm,
} from "@/lib/google-forms";

export async function GET() {
  try {
    /*
     * test配下のAPIを本番環境では動かさない。
     */
    if (
      process.env.NODE_ENV === "production"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "このテストAPIは本番環境では使用できません。",
        },
        {
          status: 404,
        },
      );
    }

    const form =
      await createEventGoogleForm({
        title:
          "イベント申込フォーム共通関数テスト",

        description:
          "共通関数から作成したテストフォームです。",

        questions: [
          {
            title: "会員ID",
            description:
              "テスト用の質問です。",
            required: true,
            type: "SHORT_TEXT",
          },

          {
            title: "参加区分",
            required: true,
            type: "RADIO",
            options: [
              "参加する",
              "キャンセル待ちを希望する",
            ],
          },

          {
            title: "備考",
            required: false,
            type: "LONG_TEXT",
          },
        ],
      });

    return NextResponse.json({
      success: true,
      message:
        "共通関数から質問付きGoogleフォームを非公開状態で作成しました。",
      form,
    });
  } catch (error) {
    console.error(
      "Google Forms creation test error:",
      error,
    );

    const detail =
      error instanceof Error
        ? error.message
        : "不明なエラーが発生しました。";

    return NextResponse.json(
      {
        success: false,
        error:
          "Googleフォームの作成テストに失敗しました。",
        detail,
      },
      {
        status: 500,
      },
    );
  }
}
