import { LOCAL_STORAGE_KEYS } from '../constants.js';
import * as gamificationService from './gamificationService.js';
import * as firebaseService from './firebaseService.js';

let history = [];

async function loadHistory() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.HISTORY);
        if (stored) history = JSON.parse(stored);
        
        const remote = await firebaseService.fetchUserData('history');
        if (remote && remote.items) {
            // Simple merge: remote is truth, but don't lose very fresh local items
            const remoteIds = new Set(remote.items.map(i => i.id));
            const freshLocal = history.filter(i => !remoteIds.has(i.id));
            history = [...freshLocal, ...remote.items].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 100);
            localStorage.setItem(LOCAL_STORAGE_KEYS.HISTORY, JSON.stringify(history));
        }
        window.dispatchEvent(new CustomEvent('history-updated'));
    } catch (e) {}
}

function saveHistory() {
    localStorage.setItem(LOCAL_STORAGE_KEYS.HISTORY, JSON.stringify(history));
    firebaseService.saveUserData('history', { items: history });
    window.dispatchEvent(new CustomEvent('history-updated'));
}

export function init() { loadHistory(); }
export function getHistory() { return [...history]; }
export function getRecentHistory(count = 3) { return history.slice(0, count); }

export function addQuizAttempt(quizState) {
    const attempt = {
        id: `quiz_${Date.now()}`,
        type: 'quiz',
        topic: quizState.topic,
        score: quizState.score,
        totalQuestions: quizState.totalQuestions,
        date: new Date().toISOString(),
        xpGained: quizState.xpGained || 0
    };
    history.unshift(attempt);
    saveHistory();
    gamificationService.updateStatsOnQuizCompletion(attempt);
}

export function addAuralSession(sessionData) {
    history.unshift({
        id: `aural_${Date.now()}`,
        type: 'aural',
        topic: sessionData.topic || 'Audio Session',
        date: new Date().toISOString(),
        duration: sessionData.duration,
        transcript: sessionData.transcript,
        xpGained: sessionData.xpGained || 0
    });
    saveHistory();
}

export function clearHistory() {
    history = [];
    saveHistory();
}
