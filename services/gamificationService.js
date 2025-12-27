import { LOCAL_STORAGE_KEYS } from '../constants.js';
import * as firebaseService from './firebaseService.js';

const defaultStats = {
    level: 1,
    xp: 0,
    currentStreak: 0,
    lastQuizDate: null,
    totalQuizzesCompleted: 0,
    totalPerfectQuizzes: 0,
    questionsSaved: 0,
    fastAnswersCount: 0, 
    nightOwlSessions: 0, 
    totalAuralMinutes: 0,
    uniqueTopicsPlayed: [],
};

let stats = { ...defaultStats };

async function loadStats() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION);
        if (stored) stats = { ...defaultStats, ...JSON.parse(stored) };
        
        const remote = await firebaseService.fetchUserData('gamification');
        if (remote) {
            if (remote.xp > stats.xp || remote.level > stats.level) {
                stats = { ...stats, ...remote };
                localStorage.setItem(LOCAL_STORAGE_KEYS.GAMIFICATION, JSON.stringify(stats));
            }
        }
        firebaseService.updateLeaderboardScore(stats);
        window.dispatchEvent(new CustomEvent('gamification-updated'));
    } catch (e) {
        console.error("Stats Init Error:", e);
    }
}

function saveStats() {
    localStorage.setItem(LOCAL_STORAGE_KEYS.GAMIFICATION, JSON.stringify(stats));
    firebaseService.saveUserData('gamification', stats);
    firebaseService.updateLeaderboardScore(stats);
    window.dispatchEvent(new CustomEvent('gamification-updated'));
}

export function init() { loadStats(); }
export function getStats() { return { ...stats }; }
export function getXpForNextLevel(level) { return level * 1000; }

export function updateStatsOnQuizCompletion(quizAttempt) {
    const today = new Date();
    const last = stats.lastQuizDate ? new Date(stats.lastQuizDate) : null;
    
    if (last) {
        const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) stats.currentStreak++;
        else if (diffDays > 1) stats.currentStreak = 1;
    } else {
        stats.currentStreak = 1;
    }

    stats.lastQuizDate = today.toISOString();
    stats.xp += (quizAttempt.xpGained || 50);
    stats.totalQuizzesCompleted++;

    while (stats.xp >= getXpForNextLevel(stats.level)) {
        stats.xp -= getXpForNextLevel(stats.level);
        stats.level++;
        window.dispatchEvent(new CustomEvent('level-up', { detail: { level: stats.level } }));
    }
    saveStats();
}

export function checkQuestProgress(event) {
    if (event.type === 'save_question') {
        stats.questionsSaved++;
        saveStats();
    }
}

export function getAchievementsProgress() {
    return [
        { id: 'consistency', name: 'Habitual Learner', description: '3-day learning streak.', icon: 'zap', target: 3, currentValue: stats.currentStreak, isUnlocked: stats.currentStreak >= 3, progressPercent: Math.min(100, (stats.currentStreak / 3) * 100) },
        { id: 'perfect', name: 'Flawless', description: '5 perfect quizzes.', icon: 'target', target: 5, currentValue: stats.totalPerfectQuizzes, isUnlocked: stats.totalPerfectQuizzes >= 5, progressPercent: Math.min(100, (stats.totalPerfectQuizzes / 5) * 100) }
    ];
}
