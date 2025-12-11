
import { LOCAL_STORAGE_KEYS } from '../constants.js';
import { showToast } from './toastService.js';
import * as gamificationService from './gamificationService.js';
import { db, doc, getDoc, setDoc, getUserId, isGuest } from './firebaseService.js';

let history = [];

async function loadHistory() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.HISTORY);
        history = stored ? JSON.parse(stored) : [];
        
        if (navigator.onLine && !isGuest()) {
            const userId = getUserId();
            if (userId) {
                const docRef = doc(db, "users", userId, "data", "history");
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const remoteData = docSnap.data().items || [];
                    if (JSON.stringify(remoteData) !== JSON.stringify(history)) {
                        history = remoteData;
                        saveHistoryLocal();
                        window.dispatchEvent(new CustomEvent('history-updated'));
                    }
                }
            }
        }
    } catch (e) {
        console.error("Failed to load quiz history:", e);
    }
}

function saveHistory() {
    saveHistoryLocal();
    saveHistoryRemote();
}

function saveHistoryLocal() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
        console.error("Failed to save history locally:", e);
    }
}

async function saveHistoryRemote() {
    if (!navigator.onLine || isGuest()) return;
    try {
        const userId = getUserId();
        if (userId) {
            await setDoc(doc(db, "users", userId, "data", "history"), { 
                items: history,
                lastUpdated: new Date().toISOString() 
            });
        }
    } catch (e) {
        console.warn("Failed to save history to cloud:", e);
    }
}

export function init() {
    loadHistory();
}

export function getHistory() {
    return [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getRecentHistory(count = 3) {
    return getHistory().slice(0, count);
}

export function getLastContext() {
    const sorted = getHistory();
    const lastStruggle = sorted.find(h => h.type === 'quiz' && (h.score / h.totalQuestions) < 0.7);
    
    if (lastStruggle) {
        return `The user recently struggled with "${lastStruggle.topic}" (Score: ${lastStruggle.score}/${lastStruggle.totalQuestions}). Offer to help clarify concepts from that topic.`;
    }
    
    const lastActivity = sorted[0];
    if (lastActivity) {
        return `The user recently completed "${lastActivity.topic}". Ask if they want to deepen their knowledge there.`;
    }
    
    return "The user is starting a new session. Ask what they want to learn today.";
}

export function addQuizAttempt(quizState) {
    if (!quizState || !quizState.questions || quizState.questions.length === 0) {
        return;
    }

    const attemptId = `quiz_${quizState.startTime}`;

    if (history.some(attempt => attempt.id === attemptId)) return;

    const newAttempt = {
        id: attemptId,
        type: 'quiz',
        topic: quizState.topic,
        score: quizState.score,
        totalQuestions: quizState.questions.length,
        difficulty: quizState.difficulty || 'medium',
        date: new Date(quizState.endTime).toISOString(),
        xpGained: quizState.xpGained,
        // Optional: Track fast answers for analysis
        fastAnswers: quizState.fastAnswers || 0
    };

    history.unshift(newAttempt);
    if (history.length > 50) history.pop();
    saveHistory();
    
    // Pass the entire object so gamificationService can see fastAnswers
    gamificationService.updateStatsOnQuizCompletion(newAttempt);
}

export function addAuralSession(sessionData) {
    if (!sessionData || !sessionData.transcript || sessionData.transcript.length === 0) return;

    const newSession = {
        id: `aural_${Date.now()}`,
        type: 'aural',
        topic: 'Aural Tutor Session',
        date: new Date().toISOString(),
        duration: sessionData.duration, // in seconds
        transcript: sessionData.transcript,
        xpGained: sessionData.xpGained || 0
    };

    history.unshift(newSession);
    if (history.length > 50) history.pop();
    saveHistory();
    
    // Trigger Audiophile Achievement
    gamificationService.checkQuestProgress({ 
        type: 'aural_session', 
        data: { duration: sessionData.duration } 
    });
}

export function clearHistory() {
    history = [];
    saveHistory();
    showToast('History cleared.');
}
