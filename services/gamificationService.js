import { LOCAL_STORAGE_KEYS } from '../constants.js';
import { showToast } from './toastService.js';

const defaultStats = {
    level: 1,
    xp: 0,
    currentStreak: 0,
    lastQuizDate: null,
    unlockedAchievements: [],
};

let stats = { ...defaultStats };

const ACHIEVEMENTS = {
    // Quiz Completion Achievements
    novice: { 
        name: "Novice", 
        description: "Complete your first quiz.", 
        icon: "award", 
        color: "linear-gradient(135deg, #cd7f32 0%, #e6ac7c 100%)", // Bronze
        condition: (s, h) => h.length >= 1 
    },
    scholar: { 
        name: "Scholar", 
        description: "Complete 10 quizzes.", 
        icon: "award", 
        color: "linear-gradient(135deg, #757F9A 0%, #D7DDE8 100%)", // Silver/Metallic
        condition: (s, h) => h.length >= 10 
    },
    master: { 
        name: "Master", 
        description: "Complete 50 quizzes.", 
        icon: "award", 
        color: "linear-gradient(135deg, #F2994A 0%, #F2C94C 100%)", // Gold
        condition: (s, h) => h.length >= 50 
    },
    
    // Performance Achievements
    perfectionist: { 
        name: "Perfectionist", 
        description: "Get a 100% score on a quiz.", 
        icon: "star", 
        color: "linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)", // Deep Purple/Blue
        condition: (s, h, q) => q && q.totalQuestions > 0 && q.score / q.totalQuestions === 1 
    },
    
    // Streak Achievements
    hot_streak: { 
        name: "Hot Streak", 
        description: "Maintain a 3-day streak.", 
        icon: "zap", 
        color: "linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)", // Hot Red/Orange
        condition: (s) => s.currentStreak >= 3 
    },
    unstoppable: { 
        name: "Unstoppable", 
        description: "Maintain a 7-day streak.", 
        icon: "zap", 
        color: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", // Electric Green
        condition: (s) => s.currentStreak >= 7 
    },
    
    // Category Mastery (Example - can be expanded)
    tech_guru: { 
        name: "Tech Guru", 
        description: "Complete 5 quizzes on Technology topics.", 
        icon: "cpu", 
        color: "linear-gradient(135deg, #00b09b 0%, #96c93d 100%)", // Cyber Green/Teal
        condition: (s, h) => h.filter(item => item.topic && (item.topic.toLowerCase().includes('machine learning') || item.topic.toLowerCase().includes('cybersecurity'))).length >= 5 
    },
};


function loadStats() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION);
        stats = stored ? { ...defaultStats, ...JSON.parse(stored) } : { ...defaultStats };
    } catch (e) {
        console.error("Failed to load gamification stats:", e);
        stats = { ...defaultStats };
    }
}

function saveStats() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.GAMIFICATION, JSON.stringify(stats));
    } catch (e) {
        console.error("Failed to save gamification stats:", e);
    }
}

export function init() {
    loadStats();
}

export function getStats() {
    return { ...stats };
}

/**
 * Calculates the total XP required to reach the next level.
 * @param {number} level - The current level.
 * @returns {number} The XP needed for the next level.
 */
export function getXpForNextLevel(level) {
    return level * 100;
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

function updateStreak(today) {
    if (!stats.lastQuizDate) {
        stats.currentStreak = 1;
        showToast(`Quiz streak started! Keep it up! 🔥`);
        return;
    }

    const lastDate = new Date(stats.lastQuizDate);
    if (isSameDay(today, lastDate)) {
        // Already played today, no change
        return;
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (isSameDay(lastDate, yesterday)) {
        stats.currentStreak++;
        showToast(`Streak Extended: ${stats.currentStreak} Days! 🔥`);
    } else {
        stats.currentStreak = 1;
        showToast(`Quiz streak started! Keep it up! 🔥`);
    }
}

function checkAchievements(quizAttempt, history) {
    Object.keys(ACHIEVEMENTS).forEach(key => {
        if (!stats.unlockedAchievements.includes(key)) {
            const achievement = ACHIEVEMENTS[key];
            if (achievement.condition(stats, history, quizAttempt)) {
                stats.unlockedAchievements.push(key);
                showToast(`Achievement Unlocked: ${achievement.name}!`, 'success');
                // Dispatch a global event for other modules (like soundService) to listen to
                window.dispatchEvent(new CustomEvent('achievement-unlocked', { detail: { ...achievement, id: key } }));
            }
        }
    });
}

/**
 * Called by historyService when a quiz is completed.
 * Updates streak and checks for new achievements.
 * @param {object} quizAttempt - The structured quiz attempt object from historyService.
 * @param {Array<object>} history - The full quiz history.
 */
export function updateStatsOnQuizCompletion(quizAttempt, history) {
    const today = new Date();
    updateStreak(today);
    stats.lastQuizDate = today.toISOString();
    
    // Add XP. Use new xpGained field if available, otherwise calculate from score for backward compatibility.
    const xpGained = quizAttempt.xpGained ?? (quizAttempt.score * 10);
    if (xpGained > 0) {
        stats.xp += xpGained;
        showToast(`${xpGained} XP gained!`, 'info');
    }

    // Check for level up
    let xpForNextLevel = getXpForNextLevel(stats.level);
    while (stats.xp >= xpForNextLevel) {
        stats.level++;
        stats.xp -= xpForNextLevel;
        showToast(`Level Up! You are now Level ${stats.level}!`, 'success');
        xpForNextLevel = getXpForNextLevel(stats.level);
    }

    checkAchievements(quizAttempt, history);
    
    saveStats();
}

/**
 * Gets all achievements with their unlocked status.
 * @returns {Array<object>}
 */
export function getAchievements() {
    return Object.entries(ACHIEVEMENTS).map(([id, data]) => ({
        id,
        ...data,
        unlocked: stats.unlockedAchievements.includes(id),
    }));
}

/**
 * Calculates derived profile statistics from the quiz history.
 * @param {Array<object>} history - The user's quiz history.
 * @returns {object} An object containing aggregated stats.
 */
export function getProfileStats(history) {
    const totalQuizzes = history.length;
    const totalQuestions = history.reduce((sum, item) => sum + item.totalQuestions, 0);
    const totalCorrect = history.reduce((sum, item) => sum + item.score, 0);
    const averageScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    
    return {
        totalQuizzes,
        totalQuestions,
        averageScore,
    };
}