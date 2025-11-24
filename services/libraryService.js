
import { LOCAL_STORAGE_KEYS } from '../constants.js';
import { showToast } from './toastService.js';
import * as gamificationService from './gamificationService.js';

let library = [];

/**
 * Creates a simple, deterministic hash from a string to use as a unique ID.
 * @param {string} questionText - The text of the quiz question.
 * @returns {string} A unique ID for the question.
 */
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
 * Loads the question library from localStorage.
 * Automatically migrates old data formats to include SRS metadata.
 * @private
 */
function loadLibrary() {
    try {
        const storedLibrary = localStorage.getItem(LOCAL_STORAGE_KEYS.LIBRARY);
        if (storedLibrary) {
            library = JSON.parse(storedLibrary);
            migrateLibraryData();
        }
    } catch (e) {
        console.error("Failed to load library from localStorage", e);
        library = [];
    }
}

/**
 * Ensures all saved questions have Spaced Repetition System (SRS) metadata.
 * @private
 */
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

/**
 * Saves the current question library to localStorage.
 * @private
 */
function saveLibrary() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.LIBRARY, JSON.stringify(library));
    } catch (e) {
        console.error("Failed to save library to localStorage", e);
    }
}

// Initial load on module import.
loadLibrary();

/**
 * Gets a copy of all questions in the library.
 * @returns {Array<object>} An array of saved question objects.
 */
export function getLibrary() {
    return [...library];
}

/**
 * Saves a new question to the library if it doesn't already exist.
 * @param {object} question - The question object to save.
 * @returns {boolean} True if the question was saved, false if it was a duplicate.
 */
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

/**
 * Removes a question from the library by its ID.
 * @param {string} questionId - The ID of the question to remove.
 * @returns {boolean} True if a question was removed, false otherwise.
 */
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

/**
 * Checks if a specific question is already saved in the library.
 * @param {object} question - The question object to check.
 * @returns {boolean} True if the question is in the library.
 */
export function isQuestionSaved(question) {
    const id = hashQuestion(question.question);
    return library.some(q => q.id === id);
}

/**
 * Retrieves questions due for review based on SM-2 algorithm.
 * @returns {Array<object>} Questions where nextReviewDate <= now.
 */
export function getDueQuestions() {
    const now = Date.now();
    // Filter items that are due or overdue
    const due = library.filter(q => q.srs.nextReviewDate <= now);
    
    // Sort by due date (most overdue first)
    return due.sort((a, b) => a.srs.nextReviewDate - b.srs.nextReviewDate);
}

/**
 * Updates a question's SRS stats based on user rating (SM-2 Algorithm).
 * @param {string} questionId - The ID of the question.
 * @param {number} quality - 0 (Again), 3 (Hard), 4 (Good), 5 (Easy).
 */
export function processReview(questionId, quality) {
    const questionIndex = library.findIndex(q => q.id === questionId);
    if (questionIndex === -1) return;

    const q = library[questionIndex];
    let { interval, repetitions, easeFactor } = q.srs;

    if (quality >= 3) {
        // Correct response logic
        if (repetitions === 0) {
            interval = 1;
        } else if (repetitions === 1) {
            interval = 6;
        } else {
            interval = Math.round(interval * easeFactor);
        }
        repetitions += 1;
    } else {
        // Incorrect response logic (Reset)
        repetitions = 0;
        interval = 1;
    }

    // Update Ease Factor (SM-2 Formula)
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    // Calculate next date
    const nextReviewDate = Date.now() + (interval * 24 * 60 * 60 * 1000);

    // Update stats in memory
    library[questionIndex].srs = {
        interval,
        repetitions,
        easeFactor,
        nextReviewDate,
        lastReviewed: Date.now()
    };

    saveLibrary();
    
    // Award XP for studying
    gamificationService.checkQuestProgress({ type: 'study_session' });
}
