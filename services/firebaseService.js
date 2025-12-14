
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

// ==================================================================================
// 🚨 IMPORTANT: FIREBASE CONFIGURATION
// You must replace the placeholders below with your actual Firebase Project keys.
// Get these from: Firebase Console -> Project Settings -> General -> "Your apps"
// ==================================================================================
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
// ==================================================================================

let app, analytics, db, auth, googleProvider;
let isFirebaseActive = false;

try {
    // Basic check to see if user has replaced the placeholder
    if (firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY") {
        app = initializeApp(firebaseConfig);
        analytics = getAnalytics(app);
        db = getFirestore(app);
        auth = getAuth(app);
        googleProvider = new GoogleAuthProvider();
        isFirebaseActive = true;
        console.log("✅ Firebase Initialized");
    } else {
        console.warn("⚠️ Firebase Config is missing or using placeholders. Cloud features (Leaderboard, Sync) will be disabled.");
        throw new Error("Firebase config incomplete");
    }
} catch (e) {
    isFirebaseActive = false;
}

let currentUser = null;
let authStateCallback = null;

// --- Helper for Offline Mode ---
// If Firebase isn't configured, we use this simple local mock for Auth to let the app run.
const mockAuth = {
    user: null,
    listeners: [],
    login(email) {
        this.user = { uid: 'offline_user', email: email, displayName: email.split('@')[0], isAnonymous: false };
        this.notify();
        return Promise.resolve(this.user);
    },
    logout() {
        this.user = null;
        this.notify();
        return Promise.resolve();
    },
    notify() { this.listeners.forEach(cb => cb(this.user)); }
};

// --- Auth Getters ---
function getUserId() { return currentUser ? currentUser.uid : null; }
function getUserEmail() { 
    if (currentUser?.isAnonymous) return 'Guest Agent';
    return currentUser ? currentUser.email : null; 
}
function getUserName() {
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) return currentUser.email.split('@')[0];
    return 'Agent';
}
function getUserPhoto() { return currentUser ? currentUser.photoURL : null; }
function isGuest() { return currentUser ? currentUser.isAnonymous : false; }
function getUserProvider() {
    if (!currentUser) return null;
    if (currentUser.isAnonymous) return 'anonymous';
    return currentUser.providerData.length > 0 ? currentUser.providerData[0].providerId : 'unknown';
}

// --- Auth Actions ---

function login(email, password) {
    if (!isFirebaseActive) return mockAuth.login(email);
    return signInWithEmailAndPassword(auth, email, password);
}

function register(email, password) {
    if (!isFirebaseActive) return mockAuth.login(email);
    return createUserWithEmailAndPassword(auth, email, password);
}

function loginWithGoogle() {
    if (!isFirebaseActive) return Promise.reject("Firebase not configured");
    return signInWithPopup(auth, googleProvider);
}

function loginAsGuest() {
    if (!isFirebaseActive) {
        mockAuth.user = { uid: 'guest_' + Date.now(), isAnonymous: true, displayName: 'Guest Agent' };
        mockAuth.notify();
        return Promise.resolve(mockAuth.user);
    }
    return signInAnonymously(auth);
}

function logout() {
    if (!isFirebaseActive) return mockAuth.logout();
    return firebaseSignOut(auth);
}

function resetPassword(email) {
    if (!isFirebaseActive) return Promise.resolve();
    const url = window.location.origin + window.location.pathname;
    const actionCodeSettings = {
        url: `${url}?mode=resetPassword`,
        handleCodeInApp: true,
    };
    return sendPasswordResetEmail(auth, email, actionCodeSettings);
}

function confirmReset(code, newPassword) {
    if (!isFirebaseActive) return Promise.resolve();
    return confirmPasswordReset(auth, code, newPassword);
}

function onAuthChange(callback) {
    authStateCallback = callback;
    if (!isFirebaseActive) {
        mockAuth.listeners.push(callback);
        // Fire once immediately
        callback(mockAuth.user);
        return () => {};
    }
    return onAuthStateChanged(auth, (user) => {
        currentUser = user;
        callback(user);
    });
}

// --- Account Management ---

function updateUserProfile(profileData) {
    if (!currentUser || !isFirebaseActive) return Promise.resolve();
    return updateProfile(currentUser, profileData).then(async () => {
        await currentUser.reload();
        window.dispatchEvent(new CustomEvent('profile-updated'));
    });
}

function linkGoogle() {
    if (!isFirebaseActive || !currentUser) return Promise.reject("Not available");
    return linkWithPopup(currentUser, googleProvider);
}

function linkEmail(email, password) {
    if (!isFirebaseActive || !currentUser) return Promise.reject("Not available");
    const credential = EmailAuthProvider.credential(email, password);
    return linkWithCredential(currentUser, credential);
}

function reauthenticate(password) {
    if (!isFirebaseActive || !currentUser) return Promise.resolve();
    const cred = EmailAuthProvider.credential(currentUser.email, password);
    return reauthenticateWithCredential(currentUser, cred);
}

function changePassword(newPassword) {
    if (!isFirebaseActive || !currentUser) return Promise.resolve();
    return updatePassword(currentUser, newPassword);
}

// --- Database Wrappers (Firestore) ---

// If Firebase is inactive, we return dummy objects/promises so the app doesn't crash.
const mockDoc = { exists: () => false, data: () => ({}) };

async function getDocWrapper(ref) {
    if (!isFirebaseActive) return mockDoc;
    try { return await getDoc(ref); } catch (e) { return mockDoc; }
}

async function setDocWrapper(ref, data, options) {
    if (!isFirebaseActive) return;
    return await setDoc(ref, data, options);
}

async function getDocsWrapper(queryRef) {
    if (!isFirebaseActive) return { forEach: () => {} };
    return await getDocs(queryRef);
}

// Helpers to expose Firestore parts only if active
function docWrapper(...args) { return isFirebaseActive ? doc(db, ...args) : null; }
function collectionWrapper(...args) { return isFirebaseActive ? collection(db, ...args) : null; }

// --- Leaderboard ---

async function updateLeaderboardScore(stats) {
    if (!isFirebaseActive || !currentUser || isGuest()) return;
    
    const userRef = doc(db, "leaderboard", currentUser.uid);
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
    if (!isFirebaseActive) return [];
    
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

// Export the real Firebase SDK functions (or their safe wrappers)
export { 
    db, 
    doc as firestoreDoc, // Direct access if needed, but prefer wrappers below
    getDocWrapper as getDoc, 
    setDocWrapper as setDoc, 
    docWrapper as doc,
    collectionWrapper as collection,
    query, orderBy, limit, getDocs, // Standard exports
    
    getUserId, getUserEmail, getUserName, getUserPhoto, isGuest, getUserProvider,
    login, register, loginWithGoogle, loginAsGuest, logout, 
    resetPassword, confirmReset,
    linkGoogle, linkEmail, reauthenticate, changePassword, updateUserProfile,
    onAuthChange,
    updateLeaderboardScore, getLeaderboard
};
