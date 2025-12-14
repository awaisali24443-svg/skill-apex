
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

// Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDgdLWA8yVvKZB_QV2Aj8Eenx--O8-ftFY",
  authDomain: "knowledge-tester-web.firebaseapp.com",
  projectId: "knowledge-tester-web",
  storageBucket: "knowledge-tester-web.firebasestorage.app",
  messagingSenderId: "339283151228",
  appId: "1:339283151228:web:41954272ef6cdda0e23cf9",
  measurementId: "G-17Z8MFNP7J"
};

let app, analytics, db, auth, googleProvider;
let isSimulationMode = false;
let currentUser = null;
let authStateCallback = null;

// --- INITIALIZATION WRAPPER ---
try {
    app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    console.log("Firebase initialized successfully.");
} catch (error) {
    console.error("Firebase Initialization Failed:", error);
    enableSimulationMode();
}

// --- SIMULATION MODE ---
function enableSimulationMode() {
    if (isSimulationMode) return;
    isSimulationMode = true;
    console.log("⚠️ SIMULATION MODE ACTIVATED: Bypassing Backend");
    
    // Create a mock user immediately
    const mockUser = {
        uid: "guest_sim_" + Date.now(),
        isAnonymous: true,
        email: null,
        displayName: "Guest User",
        photoURL: null,
        providerData: [],
        reload: () => Promise.resolve()
    };
    currentUser = mockUser;
    
    // If listener is already waiting, trigger it
    if (authStateCallback) {
        setTimeout(() => authStateCallback(mockUser), 100);
    }
}

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
    return currentUser.providerData.length > 0 ? currentUser.providerData[0].providerId : 'unknown';
}

// --- Auth Functions ---

function login(email, password) {
    if (isSimulationMode) return Promise.resolve(currentUser);
    return signInWithEmailAndPassword(auth, email, password);
}

function register(email, password) {
    if (isSimulationMode) return Promise.resolve(currentUser);
    return createUserWithEmailAndPassword(auth, email, password);
}

function loginWithGoogle() {
    if (isSimulationMode) return Promise.resolve(currentUser);
    return signInWithPopup(auth, googleProvider);
}

function loginAsGuest() {
    if (isSimulationMode) return Promise.resolve(currentUser);
    return signInAnonymously(auth);
}

function logout() {
    if (isSimulationMode || (currentUser && currentUser.uid.startsWith("guest_sim_"))) {
        currentUser = null;
        if(authStateCallback) authStateCallback(null);
        return Promise.resolve();
    }
    return firebaseSignOut(auth);
}

function onAuthChange(callback) {
    authStateCallback = callback;
    
    if (isSimulationMode) {
        // Immediately return mock user if in sim mode
        setTimeout(() => callback(currentUser), 50);
        return () => {};
    }

    // Standard Firebase listener
    return onAuthStateChanged(auth, (user) => {
        if (!user && isSimulationMode) return;
        currentUser = user;
        callback(user);
    });
}

// --- Data Functions (Safe Wrappers) ---

async function updateLeaderboardScore(stats) {
    if (isSimulationMode || !currentUser || isGuest()) return;
    const userRef = doc(db, "leaderboard", currentUser.uid);
    try {
        await setDoc(userRef, {
            username: getUserName(),
            xp: stats.xp,
            level: stats.level,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
    } catch(e) { console.warn("Leaderboard update failed", e); }
}

async function getLeaderboard(limitCount = 20) {
    if (isSimulationMode) return [];
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
        return [];
    }
}

// Export wrappers
export { 
    db, doc, getDoc, setDoc, 
    getUserId, getUserEmail, getUserName, getUserPhoto, isGuest, getUserProvider,
    analytics, 
    login, register, loginWithGoogle, loginAsGuest, logout, 
    // Mock other auth functions for safety
    linkGoogle: () => Promise.reject("Not available in simulation"),
    linkEmail: () => Promise.reject("Not available in simulation"),
    reauthenticate: () => Promise.reject("Not available in simulation"),
    changePassword: () => Promise.reject("Not available in simulation"),
    updateUserProfile: () => Promise.resolve(),
    onAuthChange,
    updateLeaderboardScore, getLeaderboard, enableSimulationMode
};
