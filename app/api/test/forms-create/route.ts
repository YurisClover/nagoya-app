import "server-only";

import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getServiceAccountCredentials } from "@/lib/google-auth";

export const runtime = "nodejs";

const FORMS_SCOPES = [
  "https://www.googleapis.com/auth/forms.body",
];

function getFormsTestAuth() {
const { client_email, private_key } =
getServiceAccountCredentials();

return new google.auth.JWT({
email: client_email,
key: private_key,
scopes: FORMS_SCOPES,
});
}

export async function POST() {
try {
const auth = getFormsTestAuth();

const forms = google.forms({
version: "v1",
auth,
});

const response = await forms.forms.create({
requestBody: {
info: {
title: "Forms API JWTテスト",
documentTitle: "Forms API JWTテスト",
},
},
});

return NextResponse.json({
success: true,
formId: response.data.formId,
responderUri: response.data.responderUri,
});
} catch (error: unknown) {
console.error("Forms APIテストエラー:", error);

const message =
error instanceof Error
? error.message
: "不明なエラーが発生しました";

return NextResponse.json(
{
success: false,
message,
},
{ status: 500 },
);
}
}