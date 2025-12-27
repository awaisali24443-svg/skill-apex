
import { LOCAL_STORAGE_KEYS } from '../constants.js';
import * as firebaseService from './firebaseService.js';

let library = [];

export function hashQuestion(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash) + text.charCodeAt(i);
    return `q_${Math.abs(hash | 0)}`;
}

async function loadLibrary() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.LIBRARY);
        if (stored) library = JSON.parse(stored);
        const remote = await firebaseService.fetchUserData('library');
        if (remote && remote.items) {
            library = remote.items;
            localStorage.setItem(LOCAL_STORAGE_KEYS.LIBRARY, JSON.stringify(library));
        }
        window.dispatchEvent(new CustomEvent('library-updated'));
    } catch (e) {}
}

export function init() { loadLibrary(); }
export function getLibrary() { return [...library]; }

/**
 * CALCULATE RETENTION: Returns a percentage of estimated 
 * recall probability based on current time and SRS data.
 */
export function getRetentionScore(question) {
    if (!question.srs || question.srs.reps === 0) return 100;
    const now = Date.now();
    const elapsed = now - question.srs.lastReview;
    const intervalMs = (question.srs.interval || 1) * 86400000;
    // R = e^(-t/S) simplified for performance
    const retention = Math.exp(-elapsed / (intervalMs * 0.8));
    return Math.max(0, Math.min(100, Math.round(retention * 100)));
}

export function saveQuestion(question) {
    const id = hashQuestion(question.question);
    if (library.some(q => q.id === id)) return false;
    library.unshift({ 
        ...question, 
        id, 
        srs: { interval: 0, reps: 0, ef: 2.5, due: Date.now(), lastReview: Date.now() } 
    });
    saveLibrary();
    return true;
}

function saveLibrary() {
    localStorage.setItem(LOCAL_STORAGE_KEYS.LIBRARY, JSON.stringify(library));
    firebaseService.saveUserData('library', { items: library });
    window.dispatchEvent(new CustomEvent('library-updated'));
}

export function processReview(id, quality) {
    const q = library.find(item => item.id === id);
    if (!q) return;
    let { interval, reps, ef } = q.srs;
    if (quality >= 3) {
        if (reps === 0) interval = 1;
        else if (reps === 1) interval = 6;
        else interval = Math.round(interval * ef);
        reps++;
    } else { reps = 0; interval = 1; }
    ef = Math.max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    q.srs = { interval, reps, ef, due: Date.now() + (interval * 86400000), lastReview: Date.now() };
    saveLibrary();
}

export function removeQuestion(id) {
    library = library.filter(q => q.id !== id);
    saveLibrary();
}

export function isQuestionSaved(q) {
    return library.some(item => item.id === hashQuestion(q.question));
}

export function getDueQuestions() {
    const now = Date.now();
    return library.filter(q => q.srs.due <= now);
}
