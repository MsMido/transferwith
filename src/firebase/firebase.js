import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD7jndK466N-5uCTrCunCk2mpP2ixiMgzM",
  authDomain: "trasferwith.firebaseapp.com",
  projectId: "trasferwith",
  storageBucket: "trasferwith.firebasestorage.app",
  messagingSenderId: "462399879673",
  appId: "1:462399879673:web:73189cc5ffafb1f3d0e528",
  measurementId: "G-8XZ7NG7RNK"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// DB와 로그인 기능을 다른 파일에서 쓸 수 있게 내보내기
export const db = getFirestore(app);
export const auth = getAuth(app);