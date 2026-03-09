import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase 설정 (chaovietnam-login 프로젝트)
const firebaseConfig = {
    apiKey: "AIzaSyB5av2Ye0MqCb_vQMJkj9fw5HMSGnwqnlw",
    authDomain: "chaovietnam-login.firebaseapp.com",
    projectId: "chaovietnam-login",
    storageBucket: "chaovietnam-login.firebasestorage.app",
    messagingSenderId: "249390849714",
    appId: "1:249390849714:web:c85f3a442b947417e973ab",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
