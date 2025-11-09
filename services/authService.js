// authService.js
// This service encapsulates all Firebase authentication logic.

const auth = firebase.auth();
const db = firebase.firestore();

/**
 * Signs up a new user with email, password, and creates a user profile.
 * @param {string} email
 * @param {string} password
 * @param {string} username
 * @returns {Promise<firebase.auth.UserCredential>}
 */
export async function signUp(email, password, username) {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    // Use a batched write to ensure atomic creation of user documents
    const batch = db.batch();
    
    // 1. Create the main user document
    const userDocRef = db.collection('users').doc(user.uid);
    batch.set(userDocRef, {
        uid: user.uid,
        username: username,
        email: email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        bio: '', // Initialize bio
        pictureURL: `https://avatar.iran.liara.run/public/boy?username=${username}`, // Initialize default picture
        // Initialize progress directly inside the user document
        xp: 0,
        weeklyXP: 0,
        lastWeekReset: getWeekId(new Date()),
        streak: 0,
        lastQuizDate: null,
        challengeHighScore: 0,
    });
    
    // 2. Create the progress subcollection document
    const progressRef = userDocRef.collection('progress').doc('main');
    batch.set(progressRef, {
        levels: {},
        history: {},
        achievements: [],
    });

    // Commit the batch
    await batch.commit();

    return userCredential;
}

/**
 * Logs in a user with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<firebase.auth.UserCredential>}
 */
export function logIn(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
}

/**
 * Logs out the current user.
 * @returns {Promise<void>}
 */
export function logOut() {
    return auth.signOut();
}

/**
 * Attaches a listener for authentication state changes.
 * @param {function(firebase.User | null, boolean)} callback - The function to call when the auth state changes. The second argument is true if it's a new user's first login.
 * @returns {firebase.Unsubscribe} - The unsubscribe function.
 */
export function onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(user => {
        if (user) {
            const isNewUser = user.metadata.creationTime === user.metadata.lastSignInTime;
            callback(user, isNewUser);
        } else {
            callback(null, false);
        }
    });
}

/**
 * Gets the current authenticated user.
 * @returns {firebase.User | null}
 */
export function getCurrentUser() {
    return auth.currentUser;
}

// Helper to get week ID, consistent with progressService
function getWeekId(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${weekNo}`;
};
