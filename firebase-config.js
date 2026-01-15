// firebase-config.js (Realtime Database)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA14AXXhvJGHFfmWPnaKq9Lfj9zLwsHhpU",
  authDomain: "unicourse-b4bde.firebaseapp.com",
  projectId: "unicourse-b4bde",

  databaseURL: "https://unicourse-b4bde-default-rtdb.firebaseio.com",
  messagingSenderId: "659753530436",
  appId: "1:659753530436:web:e68d5206a236029c8a7811"
};

export const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
