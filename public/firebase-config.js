// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBNuO4_2U2bRQe7HRFixrWyh257TkLGHqg",
  authDomain: "shaans-journal-307fd.firebaseapp.com",
  projectId: "shaans-journal-307fd",
  storageBucket: "shaans-journal-307fd.firebasestorage.app",
  messagingSenderId: "1059753147939",
  appId: "1:1059753147939:web:09dbbe8941af26d4eb3b96"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);