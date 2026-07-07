import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCgVwr4dDGUas480FWt7r2u__pw2IJrlc",
  authDomain: "tile-room.firebaseapp.com",
  projectId: "tile-room",
  storageBucket: "tile-room.firebasestorage.app",
  messagingSenderId: "953858131519",
  appId: "1:953858131519:web:056602a15c4314d17b1a8a",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);