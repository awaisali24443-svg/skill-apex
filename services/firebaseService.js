
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
    getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, 
    enableIndexedDbPersistence, onSnapshot, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup,
    GoogleAuthProvider, signInAnonymously, signOut as firebaseSignOut, onAuthStateChanged, updateProfile 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { LOCAL_STORAGE_KEYS } from '../constants.js';

const firebaseConfig = {
    apiKey: "AIzaSyDgdLWA8yVvKZB_QV2Aj8Eenx--O8-ftFY",
    authDomain: "knowledge-tester-web.firebaseapp.com",
    projectId: "knowledge-tester-web",
    storageBucket: "knowledge-tester-web.firebasestorage.app",
    messagingSenderId: "339283151228",
    appId: "1:339283151228:web:1d4d5f2c7d4834ffe23cf9",
};

let app, db, auth, googleProvider;
let isOnline = false;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    enableIndexedDbPersistence(db).catch(() => {});
} catch (e) { console.error(e); }

export function monitorNeuralLink(callback) {
    const connectedRef = doc(db, "system", "heartbeat");
    return onSnapshot(connectedRef, { includeMetadataChanges: true }, (snapshot) => {
        isOnline = !snapshot.metadata.fromCache;
        callback({ status: isOnline ? 'ONLINE' : 'BUFFERING' });
    });
}

export function listenToGlobalEchoes(callback) {
    const q = query(collection(db, "global_echoes"), orderBy("timestamp", "desc"), limit(10));
    return onSnapshot(q, (snapshot) => {
        const echoes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(echoes);
    });
}

export async function broadcastEcho(type, topic) {
    if (isGuest() || !getUserId()) return;
    try {
        await addDoc(collection(db, "global_echoes"), {
            userId: getUserId(), userName: getUserName(), type, topic, timestamp: serverTimestamp()
        });
    } catch (e) {}
}

export async function populateGuestData(reset = false) {
    if (reset) {
        Object.values(LOCAL_STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    }
    // Initialize default guest state if needed
}

export function getUserId() { return auth?.currentUser?.uid; }
export function getUserName() { return auth?.currentUser?.displayName || 'Agent'; }
export function getUserEmail() { return auth?.currentUser?.email; }
export function getUserPhoto() { return auth?.currentUser?.photoURL; }
export function getUserProvider() { return auth?.currentUser?.providerData?.[0]?.providerId; }
export function isGuest() { return auth?.currentUser?.isAnonymous || !auth?.currentUser; }

export const login = (e, p) => signInWithEmailAndPassword(auth, e, p);
export const register = (e, p) => createUserWithEmailAndPassword(auth, e, p);
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginAsGuest = () => signInAnonymously(auth);
export const logout = () => firebaseSignOut(auth);
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

export async function updateUserProfile(data) {
    if (auth.currentUser) await updateProfile(auth.currentUser, data);
}

export async function saveUserData(subPath, data) {
    if (getUserId()) {
        try {
            await setDoc(doc(db, "users", getUserId(), "data", subPath), data, { merge: true });
        } catch (e) {}
    }
}

export async function fetchUserData(subPath) {
    if (!getUserId()) return null;
    try {
        const snap = await getDoc(doc(db, "users", getUserId(), "data", subPath));
        return snap.exists() ? snap.data() : null;
    } catch (e) { return null; }
}

export async function updateLeaderboardScore(stats) {
    if (isGuest() || !getUserId()) return;
    try {
        await setDoc(doc(db, "leaderboard", getUserId()), {
            username: getUserName(), xp: stats.xp, level: stats.level, lastUpdated: new Date().toISOString()
        }, { merge: true });
    } catch (e) {}
}

export async function getLeaderboard() {
    try {
        const q = query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(20));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
}

export async function syncLocalToCloud() {
    // Sync local storage items to cloud on login
}
