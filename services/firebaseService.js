
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
// 🚨 FIREBASE CONFIGURATION (LIVE)
// Keys provided by user.
// ==================================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDgdLWA8yVvKZB_QV2Aj8Eenx--O8-ftFY",
    authDomain: "knowledge-tester-web.firebaseapp.com",
    databaseURL: "https://knowledge-tester-web-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "knowledge-tester-web",
    storageBucket: "knowledge-tester-web.firebasestorage.app",
    messagingSenderId: "339283151228",
    appId: "1:339283151228:web:1d4d5f2c7d4834ffe23cf9",
    measurementId: "G-CPMFPCJ2G6"
};
// ==================================================================================

let app, analytics, db, auth, googleProvider;
let isFirebaseActive = false;

// --- INITIALIZATION ---
console.log("🔥 Initializing Firebase...");
try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY") {
        app = initializeApp(firebaseConfig);
        analytics = getAnalytics(app);
        db = getFirestore(app);
        auth = getAuth(app);
        googleProvider = new GoogleAuthProvider();
        
        isFirebaseActive = true;
        console.log("✅ Firebase Connected Successfully");
    } else {
        console.warn("⚠️ Firebase Config is missing or using placeholder.");
        isFirebaseActive = false;
    }
} catch (e) {
    console.error("❌ CRITICAL: Firebase Initialization Failed", e);
    isFirebaseActive = false;
}

let currentUser = null;
let authStateCallback = null;

// --- Helper for Offline Mode (LocalStorage Persistence) ---
const OFFLINE_USER_KEY = 'kt_offline_user';

const mockAuth = {
    user: null,
    listeners: [],
    
    init() {
        const stored = localStorage.getItem(OFFLINE_USER_KEY);
        if (stored) {
            this.user = JSON.parse(stored);
        }
    },

    login(email) {
        this.user = { 
            uid: 'offline_user_' + Date.now(), 
            email: email, 
            displayName: email.split('@')[0], 
            isAnonymous: false,
            photoURL: null
        };
        this.persist();
        this.notify();
        return Promise.resolve(this.user);
    },

    loginGuest() {
        this.user = { 
            uid: 'guest_' + Date.now(), 
            isAnonymous: true, 
            displayName: 'Guest Agent',
            email: null,
            photoURL: null
        };
        this.persist();
        this.notify();
        return Promise.resolve(this.user);
    },

    logout() {
        this.user = null;
        localStorage.removeItem(OFFLINE_USER_KEY);
        this.notify();
        return Promise.resolve();
    },

    updateProfile(data) {
        if (this.user) {
            this.user = { ...this.user, ...data };
            this.persist();
            this.notify();
        }
        return Promise.resolve();
    },

    persist() {
        if (this.user) {
            localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(this.user));
        }
    },

    notify() { 
        this.listeners.forEach(cb => cb(this.user)); 
    }
};

// Initialize mock auth state if Firebase failed
if (!isFirebaseActive) mockAuth.init();


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
    if (!isFirebaseActive) return 'offline';
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
    if (!isFirebaseActive) {
        console.error("Google Login Blocked: Firebase not active.");
        return Promise.reject({ message: "Google Login unavailable (Firebase Disconnected). Check console for details." });
    }
    return signInWithPopup(auth, googleProvider).catch(error => {
        // Handle common configuration error
        if (error.code === 'auth/unauthorized-domain') {
            console.error("⚠️ DOMAIN ERROR: You must add this domain to Firebase Console > Authentication > Settings > Authorized Domains");
            throw new Error("Domain not authorized in Firebase. Check console.");
        }
        throw error;
    });
}

function loginAsGuest() {
    if (!isFirebaseActive) return mockAuth.loginGuest();
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
        // Fire once immediately with current state (loaded from localStorage)
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
    if (!isFirebaseActive) return mockAuth.updateProfile(profileData);
    if (!currentUser) return Promise.resolve();
    
    return updateProfile(currentUser, profileData).then(async () => {
        await currentUser.reload();
        window.dispatchEvent(new CustomEvent('profile-updated'));
    });
}

function linkGoogle() {
    if (!isFirebaseActive || !currentUser) return Promise.reject({ message: "Feature unavailable in Offline Mode." });
    return linkWithPopup(currentUser, googleProvider);
}

function linkEmail(email, password) {
    if (!isFirebaseActive || !currentUser) return Promise.reject({ message: "Feature unavailable in Offline Mode." });
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

export { 
    db, 
    doc as firestoreDoc, 
    getDocWrapper as getDoc, 
    setDocWrapper as setDoc, 
    docWrapper as doc,
    collectionWrapper as collection,
    query, orderBy, limit, getDocs, 
    
    getUserId, getUserEmail, getUserName, getUserPhoto, isGuest, getUserProvider,
    login, register, loginWithGoogle, loginAsGuest, logout, 
    resetPassword, confirmReset,
    linkGoogle, linkEmail, reauthenticate, changePassword, updateUserProfile,
    onAuthChange,
    updateLeaderboardScore, getLeaderboard
};
