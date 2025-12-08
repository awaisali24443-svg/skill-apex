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

// CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDgdLWA8yVvKZB_QV2Aj8Eenx--O8-ftFY",
  authDomain: "knowledge-tester-web.firebaseapp.com",
  projectId: "knowledge-tester-web",
  storageBucket: "knowledge-tester-web.firebasestorage.app",
  messagingSenderId: "339283151228",
  appId: "1:339283151228:web:41954272ef6cdda0e23cf9",
  measurementId: "G-17Z8MFNP7J"
};

// Internal State
let app, analytics, db, auth, googleProvider;
let isInitialized = false;
let isOfflineMode = false;
let currentUser = null;
let authChangeCallback = null;

// --- MOCK DB HELPERS (Kept for historical compatibility but disabled by default) ---
function getMockDB() {
    try { return JSON.parse(localStorage.getItem('kt_mock_users') || '[]'); } 
    catch(e) { return []; }
}

function saveMockDB(users) {
    localStorage.setItem('kt_mock_users', JSON.stringify(users));
}

// --- INITIALIZATION ---
// Removed the fallback to offline mode. If this fails, the app will likely stop working,
// which ensures we don't accidentally enter a broken offline state without the user knowing.
try {
    app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    isInitialized = true;
    console.log("Firebase initialized successfully.");
} catch (e) {
    console.error("Firebase Init Failed:", e);
    // isOfflineMode = true; // DISABLED: We want to force online connection attempt
    isInitialized = false; 
}

// --- HELPERS ---
function ensureInit() {
    if (!isInitialized) throw new Error("Service initialization failed. Please check your internet connection.");
}

function triggerAuthChange() {
    if (authChangeCallback) {
        authChangeCallback(currentUser);
    }
}

// --- GETTERS ---
function getUserId() { 
    return currentUser ? currentUser.uid : null; 
}

function getUserEmail() {
    if (!currentUser) return null;
    if (currentUser.isAnonymous) return 'Guest User';
    return currentUser.email;
}

function getUserName() {
    if (!currentUser) return 'Agent';
    return currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Agent');
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
    return (currentUser.providerData && currentUser.providerData.length > 0) ? currentUser.providerData[0].providerId : 'unknown';
}

// --- AUTH ACTIONS ---

function onAuthChange(callback) {
    authChangeCallback = callback;
    
    // Normal Mode Only
    return onAuthStateChanged(auth, (user) => {
        currentUser = user;
        callback(user);
    }, (error) => {
        console.error("Auth Listener Error:", error);
        callback(null);
    });
}

function loginAsGuest() {
    ensureInit();
    return signInAnonymously(auth);
}

function login(email, password) { 
    ensureInit(); 
    return signInWithEmailAndPassword(auth, email, password);
}

function register(email, password) { 
    ensureInit(); 
    return createUserWithEmailAndPassword(auth, email, password);
}

function loginWithGoogle() { 
    ensureInit(); 
    return signInWithPopup(auth, googleProvider); 
}

function logout() { 
    ensureInit(); 
    return firebaseSignOut(auth); 
}

function resetPassword(email) {
    ensureInit();
    const url = window.location.origin + window.location.pathname;
    const actionCodeSettings = { url: `${url}?mode=resetPassword`, handleCodeInApp: true };
    return sendPasswordResetEmail(auth, email, actionCodeSettings);
}

function confirmReset(code, newPassword) { 
    ensureInit(); 
    return confirmPasswordReset(auth, code, newPassword); 
}

function updateUserProfile(profileData) {
    ensureInit();
    if (!currentUser) return Promise.reject(new Error("No user logged in"));
    return updateProfile(currentUser, profileData).then(() => currentUser.reload());
}

function linkGoogle() {
    ensureInit();
    if (!currentUser) return Promise.reject("No user");
    return linkWithPopup(currentUser, googleProvider);
}

function linkEmail(email, password) {
    ensureInit();
    if (!currentUser) return Promise.reject("No user");
    const credential = EmailAuthProvider.credential(email, password);
    return linkWithCredential(currentUser, credential);
}

function reauthenticate(password) {
    ensureInit();
    if (!currentUser) return Promise.reject(new Error("No user"));
    const cred = EmailAuthProvider.credential(currentUser.email, password);
    return reauthenticateWithCredential(currentUser, cred);
}

function changePassword(newPassword) {
    ensureInit();
    if (!currentUser) return Promise.reject(new Error("No user"));
    return updatePassword(currentUser, newPassword);
}

// --- DATA ACTIONS ---

async function updateLeaderboardScore(stats) {
    if (!isInitialized || !currentUser || isGuest()) return;
    try {
        const userRef = doc(db, "leaderboard", currentUser.uid);
        const name = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'ApexUser');
        await setDoc(userRef, {
            username: name,
            xp: stats.xp,
            level: stats.level,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
    } catch(e) { console.warn("Leaderboard update failed", e); }
}

async function getLeaderboard(limitCount = 20) {
    if (!isInitialized) return [];
    try {
        const lbRef = collection(db, "leaderboard");
        const q = query(lbRef, orderBy("xp", "desc"), limit(limitCount));
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => { results.push({ id: doc.id, ...doc.data() }); });
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