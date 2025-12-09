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

const firebaseConfig = {
  apiKey: "AIzaSyDgdLWA8yVvKZB_QV2Aj8Eenx--O8-ftFY",
  authDomain: "knowledge-tester-web.firebaseapp.com",
  projectId: "knowledge-tester-web",
  storageBucket: "knowledge-tester-web.firebasestorage.app",
  messagingSenderId: "339283151228",
  appId: "1:339283151228:web:41954272ef6cdda0e23cf9",
  measurementId: "G-17Z8MFNP7J"
};

// Guarded Initialization
let app, analytics, db, auth, googleProvider;

try {
    app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
} catch (e) {
    console.error("Firebase Initialization Failed:", e);
    // Throwing here allows the dynamic import in index.js to catch it and show the Error UI
    throw new Error("Cloud Service Initialization Failed: " + e.message);
}

let currentUser = null;

function getUserId() { return currentUser ? currentUser.uid : null; }
function getUserEmail() {
    if (!currentUser) return null;
    if (currentUser.isAnonymous) return 'Guest User';
    return currentUser.email;
}
function getUserName() {
    if (!currentUser) return 'Agent';
    return currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Agent');
}
function getUserPhoto() { return currentUser ? currentUser.photoURL : null; }
function isGuest() { return currentUser ? currentUser.isAnonymous : false; }
function getUserProvider() {
    if (!currentUser) return null;
    if (currentUser.isAnonymous) return 'anonymous';
    return currentUser.providerData.length > 0 ? currentUser.providerData[0].providerId : 'unknown';
}

function login(email, password) { return signInWithEmailAndPassword(auth, email, password); }
function register(email, password) { return createUserWithEmailAndPassword(auth, email, password); }
function loginWithGoogle() { return signInWithPopup(auth, googleProvider); }
function loginAsGuest() { return signInAnonymously(auth); }
function logout() { return firebaseSignOut(auth); }

function resetPassword(email) {
    const url = window.location.origin + window.location.pathname;
    const actionCodeSettings = { url: `${url}?mode=resetPassword`, handleCodeInApp: true };
    return sendPasswordResetEmail(auth, email, actionCodeSettings);
}
function confirmReset(code, newPassword) { return confirmPasswordReset(auth, code, newPassword); }

function onAuthChange(callback) {
    return onAuthStateChanged(auth, (user) => {
        currentUser = user;
        callback(user);
    });
}

function updateUserProfile(profileData) {
    if (!currentUser) return Promise.reject(new Error("No user logged in"));
    return updateProfile(currentUser, profileData).then(() => currentUser.reload());
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
    const cred = EmailAuthProvider.credential(currentUser.email, password);
    return reauthenticateWithCredential(currentUser, cred);
}

function changePassword(newPassword) {
    if (!currentUser) return Promise.reject(new Error("No user"));
    return updatePassword(currentUser, newPassword);
}

async function updateLeaderboardScore(stats) {
    if (!currentUser || isGuest()) return;
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

async function getLeaderboard(limitCount = 20) {
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