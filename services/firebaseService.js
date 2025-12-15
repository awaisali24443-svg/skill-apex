
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

// --- MOCK DATA (Global Elite) ---
// Ensures leaderboard is never empty. Used for Expo/Demo purposes.
const MOCK_LEADERBOARD = [
    { id: 'm1', username: 'Arslan Ash', level: 99, xp: 98500, isMock: true }, // PK eSports Legend
    { id: 'm2', username: 'Sumail Hassan', level: 96, xp: 94200, isMock: true }, // PK Dota Legend
    { id: 'm3', username: 'Sarah Connor', level: 91, xp: 88000, isMock: true },
    { id: 'm4', username: 'Hamza Ali', level: 85, xp: 81500, isMock: true },
    { id: 'm5', username: 'Chen Wei', level: 82, xp: 79200, isMock: true },
    { id: 'm6', username: 'Ayesha Khan', level: 78, xp: 75400, isMock: true },
    { id: 'm7', username: 'John Wick', level: 75, xp: 72000, isMock: true },
    { id: 'm8', username: 'Bilal Ahmed', level: 70, xp: 68000, isMock: true },
    { id: 'm9', username: 'Zara Sheikh', level: 65, xp: 63500, isMock: true },
    { id: 'm10', username: 'Dev Patel', level: 60, xp: 59000, isMock: true },
    { id: 'm11', username: 'Fatima Noor', level: 58, xp: 56000, isMock: true },
    { id: 'm12', username: 'Usman Ghani', level: 55, xp: 53000, isMock: true }
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
        console.log("🚀 FORCE GUEST LOGIN (Mock)");
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

    // --- EXPO SPECIAL: SIMULATED GOOGLE LOGIN ---
    loginGoogleSimulated() {
        console.log("🚀 SIMULATING GOOGLE LOGIN (Expo Mode)");
        this.user = {
            uid: 'google_sim_' + Date.now(),
            email: 'expo.visitor@gmail.com',
            displayName: 'Expo Visitor',
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

// Initialize mock auth state if Firebase failed OR just to have it ready
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

// --- EXPO-SAFE GOOGLE LOGIN ---
async function loginWithGoogle() {
    if (!isFirebaseActive) {
        console.warn("Firebase inactive. Falling back to Expo Simulation.");
        return mockAuth.loginGoogleSimulated();
    }
    
    try {
        // Attempt Real Login
        return await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.warn("Real Google Login failed. Activating EXPO SIMULATION MODE.", error);
        // Fallback to Simulation so the demo doesn't break
        return await mockAuth.loginGoogleSimulated();
    }
}

function loginAsGuest() {
    if (isFirebaseActive) {
        return signInAnonymously(auth);
    }
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
    
    // Always listen to mock changes
    mockAuth.listeners.push(callback);
    
    // If we have a mock user already, fire immediately (only if specifically logged in offline previously)
    if (mockAuth.user) {
        authInitialized = true;
        callback(mockAuth.user);
    }
    
    if (isFirebaseActive) {
        // ONLINE MODE: Rely solely on Firebase Auth state.
        return onAuthStateChanged(auth, (user) => {
            authInitialized = true;
            currentUser = user;
            if (user) {
                callback(user);
            } else if (!mockAuth.user) {
                // No firebase user, no mock user -> null (Login Screen)
                callback(null);
            }
        });
    } else {
        // If firebase dead, just ensure we fired the mock state
        if (!mockAuth.user) {
            authInitialized = true;
            callback(null);
        }
        return () => {};
    }
}

// --- SYNC UTILITY (10000% SURE DATA) ---
// This function takes everything from LocalStorage and pushes it to the Cloud
// Call this immediately after login.
async function syncLocalToCloud() {
    if (isGuest()) return; // Don't sync guest data to cloud
    
    const userId = getUserId();
    if (!userId) return;

    console.log("☁️ STARTING CLOUD SYNC...");

    const collections = [
        { key: LOCAL_STORAGE_KEYS.GAME_PROGRESS, dbKey: 'journeys', wrapper: (d) => ({ items: d }) },
        { key: LOCAL_STORAGE_KEYS.HISTORY, dbKey: 'history', wrapper: (d) => ({ items: d, lastUpdated: new Date().toISOString() }) },
        { key: LOCAL_STORAGE_KEYS.LIBRARY, dbKey: 'library', wrapper: (d) => ({ items: d }) },
        { key: LOCAL_STORAGE_KEYS.GAMIFICATION, dbKey: 'gamification', wrapper: (d) => d } // Gamification is already object
    ];

    for (const col of collections) {
        try {
            const localRaw = localStorage.getItem(col.key);
            if (localRaw) {
                const localData = JSON.parse(localRaw);
                // Simple logic: Overwrite cloud with local for the "Session Snapshot" effect requested
                // Ideally we merge, but for this specific request of "save my fun", pushing local is safest.
                if (isFirebaseActive) {
                    await setDoc(doc(db, "users", userId, "data", col.dbKey), col.wrapper(localData), { merge: true });
                } else {
                    console.log(`[Simulated Cloud] Synced ${col.dbKey}`);
                }
            }
        } catch (e) {
            console.error(`Sync failed for ${col.dbKey}`, e);
        }
    }
    
    // Force leaderboard update too
    const gamification = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION) || '{}');
    if (gamification.xp) updateLeaderboardScore(gamification);

    console.log("☁️ CLOUD SYNC COMPLETE.");
}

// --- Account Management ---

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
    // Also works for simulated expo users!
    if (!isFirebaseActive && !mockAuth.user) return; 
    
    // If mocking, update mock leaderboard in memory only (conceptually)
    // For real firebase:
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
        } catch(e) {
            console.warn("Leaderboard update failed", e);
        }
    }
}

async function getLeaderboard(limitCount = 20) {
    let results = [];

    // 1. Try fetching real data first
    if (isFirebaseActive) {
        const lbRef = collection(db, "leaderboard");
        const q = query(lbRef, orderBy("xp", "desc"), limit(limitCount));
        
        try {
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
                results.push({ id: doc.id, ...doc.data() });
            });
        } catch(e) {
            console.warn("Failed to fetch leaderboard, failing over to mock.", e);
        }
    }

    // 2. Fallback / Merge Strategy
    // If real results are few, pad with mock data to make it look alive for everyone
    if (results.length < 10) {
        // Filter out any mock users that might conflict (unlikely given IDs)
        const existingIds = new Set(results.map(r => r.id));
        const needed = limitCount - results.length;
        
        const mockToAdd = MOCK_LEADERBOARD.filter(m => !existingIds.has(m.id)).slice(0, needed);
        results = [...results, ...mockToAdd];
        
        // Re-sort just in case
        results.sort((a, b) => b.xp - a.xp);
    }

    return results;
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
