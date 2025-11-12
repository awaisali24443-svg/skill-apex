import { LOCAL_STORAGE_KEYS } from '../constants.js';
import { showToast } from './toastService.js';

let library = [];

/**
 * Creates a simple, deterministic hash from a string to use as a unique ID.
 * @param {string} questionText - The text of the quiz question.
 * @returns {string} A unique ID for the question.
 * @private
 */
function hashQuestion(questionText) {
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
 * @private
 */
function loadLibrary() {
    try {
        const storedLibrary = localStorage.getItem(LOCAL_STORAGE_KEYS.LIBRARY);
        if (storedLibrary) {
            library = JSON.parse(storedLibrary);
        }
    } catch (e) {
        console.error("Failed to load library from localStorage", e);
        library = [];
    }
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
    const questionToSave = { ...question, id };
    library.unshift(questionToSave);
    saveLibrary();
    showToast('Question saved to library!');
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
 * Retrieves all saved questions for a general study session.
 * @returns {Array<object>} A copy of all questions in the library.
 */
export function getQuestionsForStudy() {
    return [...library];
}