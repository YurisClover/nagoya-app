import "server-only";

export type ServiceAccountCredentials = {
    client_email: string;
    private_key: string;
};

// decode service account from env
// return credential : each lib create auth client library
export function getServiceAccountCredentials(): ServiceAccountCredentials {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if(!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
    const c = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
    return {
        client_email: c.client_email,
        private_key: String(c.private_key).replace(/\\n/g, "\n"),
    };
}