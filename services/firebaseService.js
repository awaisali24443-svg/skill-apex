
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
const MOCK_LEADERBOARD = [
    { id: 'm1', username: 'Arslan Ash', level: 99, xp: 98500, isMock: true }, 
    { id: 'm2', username: 'Sumail Hassan', level: 96, xp: 94200, isMock: true }, 
    { id: 'm3', username: 'Sarah Connor', level: 91, xp: 88000, isMock: true },
    { id: 'm4', username: 'Hamza Ali', level: 85, xp: 81500, isMock: true },
    { id: 'm5', username: 'Chen Wei', level: 30, xp: 32000, isMock: true },
    { id: 'm6', username: 'Ayesha Khan', level: 22, xp: 22400, isMock: true }, 
    { id: 'm7', username: 'John Wick', level: 18, xp: 18000, isMock: true },
    { id: 'm8', username: 'Bilal Ahmed', level: 15, xp: 15000, isMock: true },
    { id: 'm9', username: 'Zara Sheikh', level: 12, xp: 12500, isMock: true },
    { id: 'm10', username: 'Dev Patel', level: 10, xp: 10000, isMock: true }
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
        console.log("🚀 FORCE ADMIN LOGIN (Mock)");
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

    // --- EXPO SPECIAL: SIMULATED GOOGLE LOGIN ---
    loginGoogleSimulated() {
        console.log("🚀 SIMULATING GOOGLE LOGIN (Expo Mode)");
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

// Initialize mock auth state
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
        return await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.warn("Real Google Login failed. Activating EXPO SIMULATION MODE.", error);
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

// --- SYNC UTILITY ---
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

// --- Database Wrappers ---

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

function docWrapper(...args) { return isFirebaseActive ? doc(db, ...args) : null; }
function collectionWrapper(...args) { return isFirebaseActive ? collection(db, ...args) : null; }

// --- Leaderboard ---

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
        } catch(e) {
            console.warn("Leaderboard update failed", e);
        }
    }
}

async function getLeaderboard(limitCount = 20) {
    let results = [];
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

    if (results.length < 10) {
        const existingIds = new Set(results.map(r => r.id));
        const needed = limitCount - results.length;
        const mockToAdd = MOCK_LEADERBOARD.filter(m => !existingIds.has(m.id)).slice(0, needed);
        results = [...results, ...mockToAdd];
        results.sort((a, b) => b.xp - a.xp);
    }
    return results;
}

// --- HELPER: Resume/Start Level Content ---
function seedLevelCache(topic, level, data) {
    const key = `kt-level-cache-${topic.toLowerCase()}-${level}`;
    const cacheEntry = { timestamp: Date.now(), data: data };
    localStorage.setItem(key, JSON.stringify(cacheEntry));
}

// --- HELPER: Load Demo Data ---
export async function populateGuestData(forceOverwrite = false) {
    console.log(`Initializing Admin Simulation Protocol (Force: ${forceOverwrite})...`);

    try {
        const response = await fetch('data/demo_profile.json');
        if (!response.ok) throw new Error("Could not load demo profile");
        
        const demoData = await response.json();
        const now = Date.now();
        const dayMs = 86400000;

        if (forceOverwrite || !localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION)) {
            const stats = demoData.gamification;
            stats.lastQuizDate = new Date().toISOString();
            stats.dailyQuests = { date: new Date().toDateString(), quests: [] };
            stats.dailyChallenge = { date: new Date().toDateString(), completed: false };
            localStorage.setItem(LOCAL_STORAGE_KEYS.GAMIFICATION, JSON.stringify(stats));
        }

        if (forceOverwrite || !localStorage.getItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS)) {
            const journeys = demoData.journeys.map(j => ({
                ...j,
                createdAt: new Date(now - (Math.random() * dayMs * 5)).toISOString()
            }));
            localStorage.setItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS, JSON.stringify(journeys));
        }

        if (forceOverwrite || !localStorage.getItem(LOCAL_STORAGE_KEYS.HISTORY)) {
            const history = demoData.history.map((h, index) => {
                const offset = h.dayOffset !== undefined ? h.dayOffset : index;
                const date = new Date(now - (offset * dayMs));
                return {
                    id: `hist_admin_${index}`,
                    ...h,
                    date: date.toISOString()
                };
            });
            history.sort((a, b) => new Date(b.date) - new Date(a.date));
            localStorage.setItem(LOCAL_STORAGE_KEYS.HISTORY, JSON.stringify(history));
        }

        if (forceOverwrite || !localStorage.getItem(LOCAL_STORAGE_KEYS.LIBRARY)) {
            const library = demoData.library.map(q => ({
                ...q,
                srs: { interval: 0, repetitions: 0, easeFactor: 2.5, nextReviewDate: now, lastReviewed: null }
            }));
            localStorage.setItem(LOCAL_STORAGE_KEYS.LIBRARY, JSON.stringify(library));
        }

        if (demoData.level_cache) {
            Object.entries(demoData.level_cache).forEach(([key, data]) => {
                const [topic, level] = key.split('-');
                seedLevelCache(topic, parseInt(level), data);
            });
        }

        console.log("✅ Admin Data Injection Complete. History and Library populated.");

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
