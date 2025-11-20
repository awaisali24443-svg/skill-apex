import { LOCAL_STORAGE_KEYS } from '../constants.js';
import { showToast } from './toastService.js';

const defaultStats = {
    level: 1,
    xp: 0,
    currentStreak: 0,
    lastQuizDate: null,
    unlockedAchievements: [],
    dailyQuests: { date: null, quests: [] }
};

let stats = { ...defaultStats };

const ACHIEVEMENTS = {
    novice: { name: "Novice", description: "Complete your first quiz.", icon: "award", color: "linear-gradient(135deg, #cd7f32 0%, #e6ac7c 100%)", condition: (s, h) => h.length >= 1 },
    scholar: { name: "Scholar", description: "Complete 10 quizzes.", icon: "award", color: "linear-gradient(135deg, #757F9A 0%, #D7DDE8 100%)", condition: (s, h) => h.length >= 10 },
    master: { name: "Master", description: "Complete 50 quizzes.", icon: "award", color: "linear-gradient(135deg, #F2994A 0%, #F2C94C 100%)", condition: (s, h) => h.length >= 50 },
    perfectionist: { name: "Perfectionist", description: "Get a 100% score on a quiz.", icon: "star", color: "linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)", condition: (s, h, q) => q && q.totalQuestions > 0 && q.score / q.totalQuestions === 1 },
    hot_streak: { name: "Hot Streak", description: "Maintain a 3-day streak.", icon: "zap", color: "linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)", condition: (s) => s.currentStreak >= 3 },
    unstoppable: { name: "Unstoppable", description: "Maintain a 7-day streak.", icon: "zap", color: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", condition: (s) => s.currentStreak >= 7 },
    tech_guru: { name: "Tech Guru", description: "Complete 5 quizzes on Technology topics.", icon: "cpu", color: "linear-gradient(135deg, #00b09b 0%, #96c93d 100%)", condition: (s, h) => h.filter(item => item.topic && (item.topic.toLowerCase().includes('machine learning') || item.topic.toLowerCase().includes('cybersecurity'))).length >= 5 },
};

const QUEST_TYPES = [
    { id: 'complete_level', text: 'Complete 1 Level', xp: 50, check: (action) => action.type === 'complete_level' },
    { id: 'perfect_score', text: 'Get 100% on a Quiz', xp: 100, check: (action) => action.type === 'complete_level' && action.data.scorePercent === 1 },
    { id: 'use_hint', text: 'Use a Hint', xp: 20, check: (action) => action.type === 'use_hint' },
    { id: 'save_question', text: 'Save a Question to Library', xp: 30, check: (action) => action.type === 'save_question' },
];

function loadStats() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION);
        stats = stored ? { ...defaultStats, ...JSON.parse(stored) } : { ...defaultStats };
        checkDailyQuests();
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

function checkDailyQuests() {
    const today = new Date().toDateString();
    if (stats.dailyQuests.date !== today) {
        // Generate new quests
        const shuffled = [...QUEST_TYPES].sort(() => 0.5 - Math.random());
        const newQuests = shuffled.slice(0, 3).map(q => ({ ...q, completed: false }));
        stats.dailyQuests = { date: today, quests: newQuests };
        saveStats();
    }
}

export function checkQuestProgress(action) {
    let questUpdated = false;
    stats.dailyQuests.quests.forEach(quest => {
        if (!quest.completed) {
            const definition = QUEST_TYPES.find(t => t.id === quest.id);
            if (definition && definition.check(action)) {
                quest.completed = true;
                stats.xp += definition.xp;
                showToast(`Quest Completed: ${definition.text} (+${definition.xp} XP)`, 'success');
                questUpdated = true;
            }
        }
    });
    if (questUpdated) saveStats();
}

export function init() {
    loadStats();
}

export function getStats() {
    return { ...stats };
}

export function getDailyQuests() {
    return stats.dailyQuests.quests;
}

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
    if (isSameDay(today, lastDate)) return;
    
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
                window.dispatchEvent(new CustomEvent('achievement-unlocked', { detail: { ...achievement, id: key } }));
            }
        }
    });
}

export function updateStatsOnQuizCompletion(quizAttempt, history) {
    const today = new Date();
    updateStreak(today);
    stats.lastQuizDate = today.toISOString();
    
    const xpGained = quizAttempt.xpGained ?? (quizAttempt.score * 10);
    if (xpGained > 0) {
        stats.xp += xpGained;
        showToast(`${xpGained} XP gained!`, 'info');
    }

    // Check Quests
    const scorePercent = quizAttempt.totalQuestions > 0 ? quizAttempt.score / quizAttempt.totalQuestions : 0;
    checkQuestProgress({ type: 'complete_level', data: { scorePercent } });

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

export function getAchievements() {
    return Object.entries(ACHIEVEMENTS).map(([id, data]) => ({
        id,
        ...data,
        unlocked: stats.unlockedAchievements.includes(id),
    }));
}

export function getProfileStats(history) {
    const totalQuizzes = history.length;
    const totalQuestions = history.reduce((sum, item) => sum + item.totalQuestions, 0);
    const totalCorrect = history.reduce((sum, item) => sum + item.score, 0);
    const averageScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    
    return { totalQuizzes, totalQuestions, averageScore };
}