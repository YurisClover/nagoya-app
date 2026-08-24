// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
//   turbopack: {root:process.cwd(),},
// };

// export default nextConfig;

import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({ 
  dest: "public",
  // NotificationInitializer 側で手動登録するため自動登録はしない
  register: false,
  // next-pwa が生成する Service Worker の名前
  sw: "firebase-messaging-sw.js",
  // 今回はPCでService Workerを確認したいので開発環境でも有効
  disable: false,
});
const nextConfig: NextConfig = {};
export default withPWA(nextConfig);


