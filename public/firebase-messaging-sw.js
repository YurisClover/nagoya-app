importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

const firebaseConfig = {
  apiKey: "AIzaSyCPbgI651UjWQKo-YGfNZkv4gvpLJN0CN4",
  authDomain: "yhk3-6dae2.firebaseapp.com",
  projectId: "yhk3-6dae2",
  storageBucket: "yhk3-6dae2.firebasestorage.app",
  messagingSenderId: "26047967075",
  appId: "1:26047967075:web:73e0da5c94fd9e4808ad56",
  measurementId: "G-VH2RPQ4RPP"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 🌟 修正：v8系では setBackgroundMessageHandler を使います
messaging.setBackgroundMessageHandler(function(payload) {
  console.log('📮 裏方でメッセージを受け取りました！', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    // アイコンがない場合はこの行を削除してください
    icon: '/logo.png' 
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});