// services/authService.js
import { initializeFirebase } from '../firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    updateProfile,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const GUEST_SESSION_KEY = 'guestSession';
let onSessionStateChangeCallback = () => {};
let currentUserState = null;

// NEW: This is the single source of truth for auth state.
export const onSessionStateChange = (callback) => {
    onSessionStateChangeCallback = callback;
    // Check initial state when listener is attached.
    const guestSession = localStorage.getItem(GUEST_SESSION_KEY);
    currentUserState = guestSession ? JSON.parse(guestSession) : null;
    notifyStateChange();
};

// Helper to notify the app of a change.
const notifyStateChange = () => {
    if (onSessionStateChangeCallback) {
        onSessionStateChangeCallback(currentUserState);
    }
};

// --- Guest Session Management ---

const createGuestSession = () => {
    return {
        uid: `guest_${Date.now()}`,
        isGuest: true,
        displayName: 'Guest',
    };
};

export const startGuestSession = () => {
    const session = createGuestSession();
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
    currentUserState = session;
    notifyStateChange();
    return session;
};

export const isGuest = () => {
    return currentUserState?.isGuest === true;
};

// --- Unified User Management ---

export const getCurrentUser = () => {
    return currentUserState;
};

// --- Firebase Functions ---

export const signUp = async (email, password, username) => {
    const { auth, db } = initializeFirebase();
    if (!auth || !db) {
        throw { code: 'auth/unavailable', message: "Firebase is not configured on this site. Please contact the administrator." };
    }
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await updateProfile(user, { displayName: username });

    await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        username: username,
        email: email,
        createdAt: new Date().toISOString(),
        bio: '',
        pictureURL: '',
        isNewUser: true
    });

    localStorage.removeItem(GUEST_SESSION_KEY);
    // The onAuthStateChanged listener will handle state updates
    return userCredential;
};

export const logIn = async (email, password) => {
    const { auth } = initializeFirebase();
    if (!auth) {
        throw { code: 'auth/unavailable', message: "Firebase is not configured on this site. Please contact the administrator." };
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    localStorage.removeItem(GUEST_SESSION_KEY);
    // The onAuthStateChanged listener will handle state updates
    return userCredential;
};

export const logOut = async () => {
    if (isGuest()) {
        localStorage.removeItem(GUEST_SESSION_KEY);
        currentUserState = null;
        notifyStateChange();
    } else {
        const { auth } = initializeFirebase();
        if (auth) {
            await signOut(auth);
            // The onAuthStateChanged listener will set currentUserState to null and notify
        } else {
            // Fallback if firebase isn't configured but a user somehow existed
            currentUserState = null;
            notifyStateChange();
        }
    }
};

// This function will be called from global.js to hook into the live Firebase state.
export function attachFirebaseListener() {
    const { auth } = initializeFirebase();
    
    if (auth) {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // A real user is logged in, clear any guest session.
                if (isGuest()) {
                    localStorage.removeItem(GUEST_SESSION_KEY);
                }
                currentUserState = user;
            } else if (!isGuest()) {
                // User logged out from Firebase, and we are not in guest mode.
                currentUserState = null;
            }
            // If user is null but we are in guest mode, we don't change anything.
            // logOut() handles clearing guest mode explicitly.
            notifyStateChange();
        });
    } else {
        // If Firebase isn't configured, we don't attach a listener.
        // The app will rely solely on guest mode state.
        console.log("Firebase not configured, auth listener not attached.");
    }
}
