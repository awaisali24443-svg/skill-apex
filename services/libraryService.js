
import { LOCAL_STORAGE_KEYS } from '../constants.js';
import { showToast } from './toastService.js';
import * as gamificationService from './gamificationService.js';
import { db, doc, getDoc, setDoc, getUserId, isGuest } from './firebaseService.js';

let library = [];

export function hashQuestion(questionText) {
    let hash = 0;
    for (let i = 0; i < questionText.length; i++) {
        const char = questionText.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return `q_${Math.abs(hash)}`;
}

/**
 * Loads the question library and Syncs with Firebase.
 * @private
 */
async function loadLibrary() {
    try {
        const storedLibrary = localStorage.getItem(LOCAL_STORAGE_KEYS.LIBRARY);
        if (storedLibrary) {
            library = JSON.parse(storedLibrary);
            migrateLibraryData();
        }
        
        // Background Sync (Skip if Guest)
        if (navigator.onLine && !isGuest()) {
            const userId = getUserId();
            if (userId) {
                const docRef = doc(db, "users", userId, "data", "library");
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const remoteData = docSnap.data().items || [];
                    if (JSON.stringify(remoteData) !== JSON.stringify(library)) {
                        library = remoteData;
                        saveLibraryLocal();
                        window.dispatchEvent(new CustomEvent('library-updated'));
                    }
                }
            }
        }
    } catch (e) {
        console.error("Failed to load library:", e);
        library = [];
    }
}

function migrateLibraryData() {
    let updated = false;
    const now = Date.now();
    
    library = library.map(q => {
        if (q.srs === undefined) {
            updated = true;
            return {
                ...q,
                srs: {
                    interval: 0,      // Days until next review
                    repetitions: 0,   // Successful reviews in a row
                    easeFactor: 2.5,  // SM-2 difficulty multiplier
                    nextReviewDate: now, // Due immediately
                    lastReviewed: null
                }
            };
        }
        return q;
    });

    if (updated) saveLibrary();
}

function saveLibrary() {
    saveLibraryLocal();
    saveLibraryRemote();
}

function saveLibraryLocal() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.LIBRARY, JSON.stringify(library));
    } catch (e) {
        console.error("Failed to save library locally", e);
    }
}

async function saveLibraryRemote() {
    if (!navigator.onLine || isGuest()) return;
    try {
        const userId = getUserId();
        if (userId) {
            await setDoc(doc(db, "users", userId, "data", "library"), { items: library });
        }
    } catch (e) {
        console.warn("Failed to save library to cloud", e);
    }
}

// Initial load on module import.
loadLibrary();

export function getLibrary() {
    return [...library];
}

export function saveQuestion(question) {
    const id = hashQuestion(question.question);
    if (library.some(q => q.id === id)) {
        showToast('Question already in library.', 'info');
        return false;
    }
    const questionToSave = { 
        ...question, 
        id,
        srs: {
            interval: 0,
            repetitions: 0,
            easeFactor: 2.5,
            nextReviewDate: Date.now(),
            lastReviewed: null
        }
    };
    library.unshift(questionToSave);
    saveLibrary();
    showToast('Saved to Smart Library!');
    return true;
}

export function removeQuestion(questionId) {
    const initialLength = library.length;
    library = library.filter(q => q.id !== questionId);
    if (library.length < initialLength) {
        saveLibrary();
        showToast('Question removed from library.');
        return true;
    }
    return false;
}

export function isQuestionSaved(question) {
    const id = hashQuestion(question.question);
    return library.some(q => q.id === id);
}

export function getDueQuestions() {
    const now = Date.now();
    const due = library.filter(q => q.srs.nextReviewDate <= now);
    return due.sort((a, b) => a.srs.nextReviewDate - b.srs.nextReviewDate);
}

export function processReview(questionId, quality) {
    const questionIndex = library.findIndex(q => q.id === questionId);
    if (questionIndex === -1) return;

    const q = library[questionIndex];
    let { interval, repetitions, easeFactor } = q.srs;

    if (quality >= 3) {
        if (repetitions === 0) {
            interval = 1;
        } else if (repetitions === 1) {
            interval = 6;
        } else {
            interval = Math.round(interval * easeFactor);
        }
        repetitions += 1;
    } else {
        repetitions = 0;
        interval = 1;
    }

    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    const nextReviewDate = Date.now() + (interval * 24 * 60 * 60 * 1000);

    library[questionIndex].srs = {
        interval,
        repetitions,
        easeFactor,
        nextReviewDate,
        lastReviewed: Date.now()
    };

    saveLibrary();
    
    gamificationService.checkQuestProgress({ type: 'study_session' });
}
