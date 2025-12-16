
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
import { LOCAL_STORAGE_KEYS } from '../constants.js';

// ==================================================================================
// 🚨 FIREBASE CONFIGURATION (LIVE)
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
let authInitialized = false;

// --- MOCK DATA (Global Elite - Populated for Demo) ---
const MOCK_LEADERBOARD = [
    { id: 'm1', username: 'Arslan Ash', level: 99, xp: 98500, isMock: true }, 
    { id: 'm2', username: 'Sarah Connor', level: 91, xp: 88000, isMock: true },
    { id: 'm3', username: 'Zero Cool', level: 88, xp: 85400, isMock: true },
    { id: 'm4', username: 'Hamza Ali', level: 85, xp: 81500, isMock: true },
    { id: 'm5', username: 'DeepBlue', level: 76, xp: 72000, isMock: true },
    { id: 'm6', username: 'Neo', level: 72, xp: 68500, isMock: true },
    { id: 'm7', username: 'Trinity', level: 65, xp: 62000, isMock: true },
    { id: 'm8', username: 'Chen Wei', level: 50, xp: 48000, isMock: true },
    { id: 'm9', username: 'Ayesha Khan', level: 45, xp: 43200, isMock: true }, 
    { id: 'm10', username: 'John Wick', level: 42, xp: 40500, isMock: true },
    { id: 'm11', username: 'Maverick', level: 38, xp: 36000, isMock: true },
    { id: 'm12', username: 'Ripley', level: 33, xp: 31000, isMock: true },
    { id: 'm13', username: 'Bilal Ahmed', level: 25, xp: 24000, isMock: true },
    { id: 'm14', username: 'Zara Sheikh', level: 18, xp: 17500, isMock: true },
    { id: 'm15', username: 'Dev Patel', level: 10, xp: 9000, isMock: true },
    { id: 'm16', username: 'Cyber Wolf', level: 5, xp: 4500, isMock: true }
];

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
            displayName: 'Admin',
            email: null,
            photoURL: null
        };
        this.persist();
        this.notify();
        return Promise.resolve(this.user);
    },

    loginGoogleSimulated() {
        this.user = {
            uid: 'google_sim_' + Date.now(),
            email: 'admin.expo@skillapex.com',
            displayName: 'Admin',
            isAnonymous: false,
            photoURL: 'https://lh3.googleusercontent.com/a/default-user',
            providerData: [{ providerId: 'google.com' }]
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

mockAuth.init();

// --- Auth Getters ---
function getUserId() { return currentUser ? currentUser.uid : (mockAuth.user ? mockAuth.user.uid : null); }
function getUserEmail() { 
    if (currentUser) {
        if (currentUser.isAnonymous) return 'Guest Agent';
        return currentUser.email;
    }
    if (mockAuth.user) return mockAuth.user.email || 'Guest Agent';
    return null;
}
function getUserName() {
    if (currentUser) {
        if (currentUser.displayName) return currentUser.displayName;
        if (currentUser.email) return currentUser.email.split('@')[0];
    }
    if (mockAuth.user) return mockAuth.user.displayName;
    return 'Agent';
}
function getUserPhoto() { 
    if (currentUser) return currentUser.photoURL;
    if (mockAuth.user) return mockAuth.user.photoURL;
    return null; 
}
function isGuest() { 
    if (currentUser) return currentUser.isAnonymous;
    if (mockAuth.user) return mockAuth.user.isAnonymous;
    return false; 
}
function getUserProvider() {
    if (mockAuth.user) return 'offline';
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

async function loginWithGoogle() {
    if (!isFirebaseActive) return mockAuth.loginGoogleSimulated();
    try {
        return await signInWithPopup(auth, googleProvider);
    } catch (error) {
        return await mockAuth.loginGoogleSimulated();
    }
}

function loginAsGuest() {
    if (isFirebaseActive) return signInAnonymously(auth);
    return mockAuth.loginGuest();
}

function logout() {
    if (mockAuth.user) return mockAuth.logout();
    if (!isFirebaseActive) return mockAuth.logout();
    return firebaseSignOut(auth);
}

function resetPassword(email) {
    if (!isFirebaseActive) return Promise.resolve();
    const url = window.location.origin + window.location.pathname;
    const actionCodeSettings = { url: `${url}?mode=resetPassword`, handleCodeInApp: true };
    return sendPasswordResetEmail(auth, email, actionCodeSettings);
}

function confirmReset(code, newPassword) {
    if (!isFirebaseActive) return Promise.resolve();
    return confirmPasswordReset(auth, code, newPassword);
}

function onAuthChange(callback) {
    authStateCallback = callback;
    mockAuth.listeners.push(callback);
    
    if (mockAuth.user) {
        authInitialized = true;
        callback(mockAuth.user);
    }
    
    if (isFirebaseActive) {
        return onAuthStateChanged(auth, (user) => {
            authInitialized = true;
            currentUser = user;
            if (user) {
                callback(user);
            } else if (!mockAuth.user) {
                callback(null);
            }
        });
    } else {
        if (!mockAuth.user) {
            authInitialized = true;
            callback(null);
        }
        return () => {};
    }
}

async function syncLocalToCloud() {
    if (isGuest()) return; 
    const userId = getUserId();
    if (!userId) return;

    const collections = [
        { key: LOCAL_STORAGE_KEYS.GAME_PROGRESS, dbKey: 'journeys', wrapper: (d) => ({ items: d }) },
        { key: LOCAL_STORAGE_KEYS.HISTORY, dbKey: 'history', wrapper: (d) => ({ items: d, lastUpdated: new Date().toISOString() }) },
        { key: LOCAL_STORAGE_KEYS.LIBRARY, dbKey: 'library', wrapper: (d) => ({ items: d }) },
        { key: LOCAL_STORAGE_KEYS.GAMIFICATION, dbKey: 'gamification', wrapper: (d) => d }
    ];

    for (const col of collections) {
        try {
            const localRaw = localStorage.getItem(col.key);
            if (localRaw) {
                const localData = JSON.parse(localRaw);
                if (isFirebaseActive) {
                    await setDoc(doc(db, "users", userId, "data", col.dbKey), col.wrapper(localData), { merge: true });
                }
            }
        } catch (e) {
            console.error(`Sync failed for ${col.dbKey}`, e);
        }
    }
    
    const gamification = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION) || '{}');
    if (gamification.xp) updateLeaderboardScore(gamification);
}

function updateUserProfile(profileData) {
    if (mockAuth.user) return mockAuth.updateProfile(profileData);
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

async function getDocWrapper(ref) {
    if (!isFirebaseActive) return { exists: () => false, data: () => ({}) };
    try { return await getDoc(ref); } catch (e) { return { exists: () => false, data: () => ({}) }; }
}

async function setDocWrapper(ref, data, options) {
    if (!isFirebaseActive) return;
    return await setDoc(ref, data, options);
}

function docWrapper(...args) { return isFirebaseActive ? doc(db, ...args) : null; }
function collectionWrapper(...args) { return isFirebaseActive ? collection(db, ...args) : null; }

async function updateLeaderboardScore(stats) {
    if (!isFirebaseActive && !mockAuth.user) return; 
    
    if (isFirebaseActive && currentUser && !isGuest()) {
        const userRef = doc(db, "leaderboard", currentUser.uid);
        const name = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'ApexUser');
        try {
            await setDoc(userRef, {
                username: name,
                xp: stats.xp,
                level: stats.level,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        } catch(e) { console.warn("Leaderboard update failed", e); }
    }
}

async function getLeaderboard(limitCount = 20) {
    let results = [];
    
    // 1. Try Fetching Real Data if Online
    if (isFirebaseActive) {
        const lbRef = collection(db, "leaderboard");
        const q = query(lbRef, orderBy("xp", "desc"), limit(limitCount));
        try {
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
                results.push({ id: doc.id, ...doc.data() });
            });
        } catch(e) {
            console.warn("Failed to fetch leaderboard from Firebase, falling back to mocks.", e);
        }
    }

    // 2. Force Populate with Mocks if needed (Offline or Empty DB)
    // Always merge in mocks to ensure list is populated
    if (results.length < 15) {
        const existingIds = new Set(results.map(r => r.id));
        const needed = limitCount - results.length;
        
        // Filter out any mocks that might clash with real IDs (unlikely but safe)
        const mockToAdd = MOCK_LEADERBOARD
            .filter(m => !existingIds.has(m.id))
            .slice(0, needed);
            
        results = [...results, ...mockToAdd];
        
        // Re-sort to integrate real users with mocks based on XP
        results.sort((a, b) => b.xp - a.xp);
    }
    
    return results;
}

export async function populateGuestData(forceOverwrite = false) {
    try {
        const response = await fetch('data/demo_profile.json');
        if (!response.ok) throw new Error("Could not load demo profile");
        const demoData = await response.json();
        
        if (forceOverwrite || !localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION)) {
            localStorage.setItem(LOCAL_STORAGE_KEYS.GAMIFICATION, JSON.stringify(demoData.gamification));
        }
        
        // Ensure other data is also populated if missing
        if (forceOverwrite || !localStorage.getItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS)) {
             localStorage.setItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS, JSON.stringify(demoData.journeys || []));
        }
        if (forceOverwrite || !localStorage.getItem(LOCAL_STORAGE_KEYS.HISTORY)) {
             localStorage.setItem(LOCAL_STORAGE_KEYS.HISTORY, JSON.stringify(demoData.history || []));
        }
        
    } catch (e) {
        console.error("Failed to load demo profile:", e);
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
    onAuthChange, syncLocalToCloud,
    updateLeaderboardScore, getLeaderboard
};
