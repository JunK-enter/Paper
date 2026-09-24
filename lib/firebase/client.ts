import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/** 공개 웹 클라이언트 설정. 배포 환경 변수가 없어도 같은 Firebase 프로젝트에 연결됩니다. */
const hostedConfig: FirebasePublicConfig = {
  apiKey: "AIzaSyCQ_yFVBJ-GCSABPHlQLcUwqWXZb1nuBmQ",
  authDomain: "folio-11bd9.firebaseapp.com",
  projectId: "folio-11bd9",
  storageBucket: "folio-11bd9.firebasestorage.app",
  messagingSenderId: "175850635146",
  appId: "1:175850635146:web:0aa27d6c4fb27737939273",
};

export function readFirebaseConfig(): FirebasePublicConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || hostedConfig.apiKey;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || hostedConfig.projectId;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || hostedConfig.authDomain;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || hostedConfig.appId;
  if (!apiKey || !projectId || !authDomain || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || hostedConfig.storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || hostedConfig.messagingSenderId,
    appId,
  };
}

export function isFirebaseConfigured() {
  return readFirebaseConfig() !== null;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function firebaseServices() {
  const config = readFirebaseConfig();
  if (!config) return null;
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = config.storageBucket ? getStorage(app) : null;
  }
  return { app: app!, auth: auth!, db: db!, storage };
}
