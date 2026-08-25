// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA14AXXhvJGHFfmWPnaKq9Lfj9zLwsHhpU",
  authDomain: "unicourse-b4bde.firebaseapp.com",
  databaseURL: "https://unicourse-b4bde-default-rtdb.firebaseio.com",
  projectId: "unicourse-b4bde",
  storageBucket: "unicourse-b4bde.firebasestorage.app",
  messagingSenderId: "659753530436",
  appId: "1:659753530436:web:e68d5206a236029c8a7811"
};

export const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
