// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_FGTClt9IZv4J_PBJbXd_RbWuXroRAIM",
  authDomain: "js-project-2abfc.firebaseapp.com",
  databaseURL: "https://js-project-2abfc-default-rtdb.firebaseio.com",
  projectId: "js-project-2abfc",
  storageBucket: "js-project-2abfc.firebasestorage.app",
  messagingSenderId: "337811464943",
  appId: "1:337811464943:web:d136d1948d10acd924311a"
};

export const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
