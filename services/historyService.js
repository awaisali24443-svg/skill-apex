
import { LOCAL_STORAGE_KEYS } from '../constants.js';
import { showToast } from './toastService.js';

let history = [];

/**
 * Loads the quiz history from localStorage.
 * @private
 */
function loadHistory() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.HISTORY);
        history = stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Failed to load quiz history:", e);
        history = [];
    }
}

/**
 * Saves the current quiz history to localStorage.
 * @private
 */
function saveHistory() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
        console.error("Failed to save quiz history:", e);
    }
}

/**
 * Initializes the history service by loading data from localStorage.
 * Should be called once on application startup.
 */
export function init() {
    loadHistory();
}

/**
 * Retrieves the entire quiz history, sorted with the most recent attempts first.
 * @returns {Array<object>} A sorted array of quiz attempt objects.
 */
export function getHistory() {
    // Return a sorted copy
    return [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Adds a completed quiz attempt to the history.
 * @param {object} quizState - The final state object of the completed quiz from quizStateService.
 */
export function addQuizAttempt(quizState) {
    if (!quizState || !quizState.questions || quizState.questions.length === 0) {
        return;
    }

    const attemptId = `hist_${quizState.startTime}`;

    // Prevent duplicate entries if user navigates back to results page
    if (history.some(attempt => attempt.id === attemptId)) {
        return;
    }

    const newAttempt = {
        id: attemptId,
        topic: quizState.topic,
        score: quizState.score,
        totalQuestions: quizState.questions.length,
        date: new Date(quizState.endTime).toISOString(),
    };

    history.unshift(newAttempt); // Add to the beginning of the array
    if (history.length > 50) { // Limit history size to prevent localStorage bloat
        history.pop();
    }
    saveHistory();
}

/**
 * Clears all entries from the quiz history.
 */
export function clearHistory() {
    history = [];
    saveHistory();
    showToast('Quiz history cleared.');
}
