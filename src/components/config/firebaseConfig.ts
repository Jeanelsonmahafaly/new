// src/firebaseConfig.ts
/*import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics"; // Optionnel

const firebaseConfig = {
    apiKey: "AIzaSyAXVE5O6zZ5M7INP3qH1TKqOS8r0W99oJ8", // Assurez-vous que c'est celle de netgold-714e5
    authDomain: "netgold-714e5.firebaseapp.com",
    projectId: "netgold-714e5",
    storageBucket: "netgold-714e5.firebasestorage.app",
    messagingSenderId: "1003237523147",
    appId: "1:1003237523147:web:dd56caede8e67ead30e54e",
    measurementId: "G-DT00BJPL84" // Optionnel
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app); // Optionnel*/

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage'; // AJOUT

const firebaseConfig = {
  apiKey: "AIzaSyA9fMT5Sj91Z3BzgcF8TvVvocRzide3nNc",
  authDomain: "datascrapr-d6250.firebaseapp.com",
  projectId: "datascrapr-d6250",
  storageBucket: "datascrapr-d6250.appspot.com",
  messagingSenderId: "861823831568",
  appId: "1:861823831568:web:f4f71e45c7d10d480d4495",
  measurementId: "G-7Q9L777MX6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // AJOUT