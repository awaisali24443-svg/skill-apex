// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE ---
// You can get this from your project's settings in the Firebase console.
// IMPORTANT: For this app to work with user accounts, you must replace
// these placeholder values with your actual Firebase project credentials.
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};


let firebaseApp, auth, db;

export const initializeFirebase = () => {
    // Only initialize if it hasn't been already
    if (firebaseApp) {
        return { firebaseApp, auth, db };
    }

    // A simple check to see if the user has replaced the placeholder config.
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.warn("Firebase is not configured. Please add your project credentials in firebase-config.js. Login/Signup for registered users will not work, but Guest Mode is available.");
        return { firebaseApp: null, auth: null, db: null };
    }

    try {
        firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        // Return nulls so the app knows initialization failed
        return { firebaseApp: null, auth: null, db: null };
    }
    
    return { firebaseApp, auth, db };
};
