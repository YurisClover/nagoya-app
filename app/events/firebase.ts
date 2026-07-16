// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getMessaging, Messaging } from "firebase/messaging";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCPbgI651UjWQKo-YGfNZkv4gvpLJN0CN4",
  authDomain: "yhk3-6dae2.firebaseapp.com",
  projectId: "yhk3-6dae2",
  storageBucket: "yhk3-6dae2.firebasestorage.app",
  messagingSenderId: "26047967075",
  appId: "1:26047967075:web:73e0da5c94fd9e4808ad56",
  measurementId: "G-VH2RPQ4RPP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ブラウザ環境（window）のときだけFCMメッセージングを有効化
let messaging: Messaging | null = null;
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  messaging = getMessaging(app);
}

export { messaging, firebaseConfig };