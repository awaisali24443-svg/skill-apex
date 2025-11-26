
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup,
    GoogleAuthProvider,
    signInAnonymously,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    linkWithPopup,
    linkWithCredential,
    EmailAuthProvider
} from "firebase/auth";

// Configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyDgdLWA8yVvKZB_QV2Aj8Eenx--O8-ftFY",
  authDomain: "knowledge-tester-web.firebaseapp.com",
  projectId: "knowledge-tester-web",
  storageBucket: "knowledge-tester-web.firebasestorage.app",
  messagingSenderId: "339283151228",
  appId: "1:339283151228:web:41954272ef6cdda0e23cf9",
  measurementId: "G-17Z8MFNP7J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;
let authStateCallback = null;

/**
 * Gets the current authenticated user ID.
 */
function getUserId() {
    return currentUser ? currentUser.uid : null;
}

function getUserEmail() {
    if (currentUser?.isAnonymous) return 'Guest User';
    return currentUser ? currentUser.email : null;
}

function isGuest() {
    return currentUser ? currentUser.isAnonymous : false;
}

// --- Auth Functions ---

function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

function register(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
}

function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
}

function loginAsGuest() {
    return signInAnonymously(auth);
}

function logout() {
    return firebaseSignOut(auth);
}

function onAuthChange(callback) {
    authStateCallback = callback;
    // Standard Firebase listener
    return onAuthStateChanged(auth, (user) => {
        currentUser = user;
        callback(user);
    });
}

// --- Account Upgrading (Linking) ---

function linkGoogle() {
    if (!currentUser) return Promise.reject("No user");
    return linkWithPopup(currentUser, googleProvider);
}

function linkEmail(email, password) {
    if (!currentUser) return Promise.reject("No user");
    const credential = EmailAuthProvider.credential(email, password);
    return linkWithCredential(currentUser, credential);
}

export { 
    db, doc, getDoc, setDoc, 
    getUserId, getUserEmail, isGuest, 
    analytics, 
    login, register, loginWithGoogle, loginAsGuest, logout, 
    linkGoogle, linkEmail,
    onAuthChange 
};
