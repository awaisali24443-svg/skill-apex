import { LOCAL_STORAGE_KEYS } from '../constants.js';
import { showToast } from './toastService.js';

let library = [];

// Simple hash function to create a unique ID for a question
function hashQuestion(questionText) {
    let hash = 0;
    for (let i = 0; i < questionText.length; i++) {
        const char = questionText.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return `q_${Math.abs(hash)}`;
}

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

function saveLibrary() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.LIBRARY, JSON.stringify(library));
    } catch (e) {
        console.error("Failed to save library to localStorage", e);
    }
}

// Initial load
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
    const questionToSave = { ...question, id };
    library.unshift(questionToSave);
    saveLibrary();
    showToast('Question saved to library!');
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

export function getQuestionsForStudy() {
    // Returns all saved questions for a general study session.
    return [...library];
}
