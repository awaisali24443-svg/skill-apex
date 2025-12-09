


import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
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
    EmailAuthProvider,
    sendPasswordResetEmail,
    confirmPasswordReset,
    updatePassword,
    reauthenticateWithCredential,
    updateProfile 
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

function getUserName() {
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email.split('@')[0];
    return 'User';
}

function getUserPhoto() {
    return currentUser ? currentUser.photoURL : null;
}

function isGuest() {
    return currentUser ? currentUser.isAnonymous : false;
}

function getUserProvider() {
    if (!currentUser) return null;
    if (currentUser.isAnonymous) return 'anonymous';
    // Return the first provider ID (e.g., 'password', 'google.com')
    return currentUser.providerData.length > 0 ? currentUser.providerData[0].providerId : 'unknown';
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

function resetPassword(email) {
    // Construct absolute URL for the app root, stripping any hash or query params
    const url = window.location.origin + window.location.pathname;
    
    const actionCodeSettings = {
        // Redirect back to this app to handle the reset
        // We append the mode query param to be detected by auth.js
        url: `${url}?mode=resetPassword`,
        handleCodeInApp: true,
    };
    return sendPasswordResetEmail(auth, email, actionCodeSettings);
}

function confirmReset(code, newPassword) {
    return confirmPasswordReset(auth, code, newPassword);
}

function onAuthChange(callback) {
    authStateCallback = callback;
    // Standard Firebase listener
    return onAuthStateChanged(auth, (user) => {
        currentUser = user;
        callback(user);
    });
}

// --- Account Management ---

function updateUserProfile(profileData) {
    if (!currentUser) return Promise.reject(new Error("No user logged in"));
    // profileData can contain { displayName: string, photoURL: string }
    return updateProfile(currentUser, profileData).then(() => {
        // Force refresh of current user object
        currentUser.reload();
    });
}

function linkGoogle() {
    if (!currentUser) return Promise.reject("No user");
    return linkWithPopup(currentUser, googleProvider);
}

function linkEmail(email, password) {
    if (!currentUser) return Promise.reject("No user");
    const credential = EmailAuthProvider.credential(email, password);
    return linkWithCredential(currentUser, credential);
}

function reauthenticate(password) {
    if (!currentUser) return Promise.reject(new Error("No user"));
    // Re-auth is required before changing sensitive info like passwords
    const cred = EmailAuthProvider.credential(currentUser.email, password);
    return reauthenticateWithCredential(currentUser, cred);
}

function changePassword(newPassword) {
    if (!currentUser) return Promise.reject(new Error("No user"));
    return updatePassword(currentUser, newPassword);
}

// --- Leaderboard ---

async function updateLeaderboardScore(stats) {
    if (!currentUser || isGuest()) return; // Guests don't rank
    
    const userRef = doc(db, "leaderboard", currentUser.uid);
    // Use display name or part of email
    const name = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'ApexUser');
    
    try {
        await setDoc(userRef, {
            username: name,
            xp: stats.xp,
            level: stats.level,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
    } catch(e) {
        console.warn("Leaderboard update failed", e);
    }
}

async function getLeaderboard(limitCount = 20) {
    const lbRef = collection(db, "leaderboard");
    const q = query(lbRef, orderBy("xp", "desc"), limit(limitCount));
    
    try {
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => {
            results.push({ id: doc.id, ...doc.data() });
        });
        return results;
    } catch(e) {
        console.warn("Failed to fetch leaderboard", e);
        return [];
    }
}

export { 
    db, doc, getDoc, setDoc, 
    getUserId, getUserEmail, getUserName, getUserPhoto, isGuest, getUserProvider,
    analytics, 
    login, register, loginWithGoogle, loginAsGuest, logout, 
    resetPassword, confirmReset,
    linkGoogle, linkEmail, reauthenticate, changePassword, updateUserProfile,
    onAuthChange,
    updateLeaderboardScore, getLeaderboard
};
