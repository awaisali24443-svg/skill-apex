
import { LOCAL_STORAGE_KEYS } from '../constants.js';
import { showToast } from './toastService.js';

const defaultStats = {
    level: 1,
    xp: 0,
    currentStreak: 0,
    lastQuizDate: null,
    unlockedAchievements: [],
    dailyQuests: { date: null, quests: [] },
    dailyChallenge: { date: null, completed: false }
};

let stats = { ...defaultStats };

const ACHIEVEMENTS = {
    // --- Starter ---
    novice: { name: "First Step", description: "Complete your first quiz.", icon: "award", color: "linear-gradient(135deg, #8e2de2, #4a00e0)", condition: (s, h) => h.length >= 1 },
    
    // --- Volume ---
    scholar: { name: "Scholar", description: "Complete 10 quizzes.", icon: "book", color: "linear-gradient(135deg, #11998e, #38ef7d)", condition: (s, h) => h.length >= 10 },
    library_builder: { name: "Librarian", description: "Save 5 questions to your library.", icon: "book", color: "linear-gradient(135deg, #f2994a, #f2c94c)", condition: (s, h, q, lib) => lib && lib.length >= 5 },
    veteran: { name: "Veteran", description: "Complete 50 quizzes.", icon: "shield", color: "linear-gradient(135deg, #ec008c, #fc6767)", condition: (s, h) => h.length >= 50 },
    
    // --- Skill ---
    perfectionist: { name: "Perfectionist", description: "Get 100% on a quiz.", icon: "star", color: "linear-gradient(135deg, #ffd700, #fdb931)", condition: (s, h, q) => q && q.totalQuestions > 0 && q.score === q.totalQuestions },
    speed_demon: { name: "Speed Demon", description: "Complete a quiz in under 30 seconds.", icon: "zap", color: "linear-gradient(135deg, #ffff00, #ff0000)", condition: (s, h, q) => q && (new Date(q.endTime) - new Date(q.startTime)) < 30000 },
    
    // --- Streaks & Habits ---
    three_peat: { name: "Heating Up", description: "3-day streak.", icon: "zap", color: "linear-gradient(135deg, #ff416c, #ff4b2b)", condition: (s) => s.currentStreak >= 3 },
    week_warrior: { name: "Unstoppable", description: "7-day streak.", icon: "zap", color: "linear-gradient(135deg, #a8ff78, #78ffd6)", condition: (s) => s.currentStreak >= 7 },
    night_owl: { name: "Night Owl", description: "Complete a quiz after 10 PM.", icon: "target", color: "linear-gradient(135deg, #2c3e50, #4ca1af)", condition: (s, h, q) => q && new Date(q.endTime).getHours() >= 22 },
    early_bird: { name: "Early Bird", description: "Complete a quiz before 8 AM.", icon: "target", color: "linear-gradient(135deg, #ff9966, #ff5e62)", condition: (s, h, q) => q && new Date(q.endTime).getHours() < 8 },

    // --- Mastery ---
    polymath: { name: "Polymath", description: "Complete quizzes in 3 different topics.", icon: "cpu", color: "linear-gradient(135deg, #fc466b, #3f5efb)", condition: (s, h) => {
        const topics = new Set(h.map(i => i.topic.split('-')[0].trim()));
        return topics.size >= 3;
    }},
};

const QUEST_TYPES = [
    { id: 'complete_level', text: 'Complete 1 Level', xp: 50, check: (action) => action.type === 'complete_level' },
    { id: 'perfect_score', text: 'Get 100% on a Quiz', xp: 100, check: (action) => action.type === 'complete_level' && action.data.scorePercent === 1 },
    { id: 'use_hint', text: 'Use a Hint', xp: 20, check: (action) => action.type === 'use_hint' },
    { id: 'save_question', text: 'Save a Question', xp: 30, check: (action) => action.type === 'save_question' },
    { id: 'study_session', text: 'Review Flashcards', xp: 40, check: (action) => action.type === 'study_session' },
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
        const shuffled = [...QUEST_TYPES].sort(() => 0.5 - Math.random());
        const newQuests = shuffled.slice(0, 3).map(q => ({ ...q, completed: false }));
        stats.dailyQuests = { date: today, quests: newQuests };
        stats.dailyChallenge = { date: today, completed: false };
        saveStats();
    }
}

export function isDailyChallengeCompleted() {
    return stats.dailyChallenge && stats.dailyChallenge.completed;
}

export function completeDailyChallenge() {
    if (!stats.dailyChallenge.completed) {
        stats.dailyChallenge.completed = true;
        stats.xp += 200; 
        showToast("Daily Challenge Complete! +200 XP", "success");
        saveStats();
        return true;
    }
    return false;
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
    const libraryStr = localStorage.getItem(LOCAL_STORAGE_KEYS.LIBRARY);
    const library = libraryStr ? JSON.parse(libraryStr) : [];

    Object.keys(ACHIEVEMENTS).forEach(key => {
        if (!stats.unlockedAchievements.includes(key)) {
            const achievement = ACHIEVEMENTS[key];
            if (achievement.condition(stats, history, quizAttempt, library)) {
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

    const scorePercent = quizAttempt.totalQuestions > 0 ? quizAttempt.score / quizAttempt.totalQuestions : 0;
    checkQuestProgress({ type: 'complete_level', data: { scorePercent } });

    let xpForNextLevel = getXpForNextLevel(stats.level);
    let didLevelUp = false;
    while (stats.xp >= xpForNextLevel) {
        stats.level++;
        stats.xp -= xpForNextLevel;
        didLevelUp = true;
        xpForNextLevel = getXpForNextLevel(stats.level);
    }

    if (didLevelUp) {
        window.dispatchEvent(new CustomEvent('level-up', { detail: { level: stats.level } }));
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

// Helper to get raw map of topic dates
function getTopicLastPlayedDates(history) {
    const topicDates = {};
    history.forEach(h => {
        const cleanTopic = h.topic.split('-')[0].trim();
        const date = new Date(h.date).getTime();
        if (!topicDates[cleanTopic] || date > topicDates[cleanTopic]) {
            topicDates[cleanTopic] = date;
        }
    });
    return topicDates;
}

// --- Memory Health Logic ---

const GRACE_PERIOD_DAYS = 3; 
const DECAY_RATE_PER_DAY = 2; 

export function calculateMemoryHealth(history) {
    const topicDates = getTopicLastPlayedDates(history);
    const topics = Object.keys(topicDates);
    
    if (topics.length === 0) return { health: 100, status: 'Stable', oldestTopic: null };

    let oldestDate = Date.now();
    let oldestTopic = null;
    let totalDecay = 0;
    const now = Date.now();
    const DAY_MS = 86400000;

    topics.forEach(t => {
        const daysSince = (now - topicDates[t]) / DAY_MS;
        let decay = 0;
        if (daysSince > GRACE_PERIOD_DAYS) {
            decay = Math.min(100, (daysSince - GRACE_PERIOD_DAYS) * DECAY_RATE_PER_DAY);
        }
        totalDecay += decay;

        if (topicDates[t] < oldestDate) {
            oldestDate = topicDates[t];
            oldestTopic = t;
        }
    });

    const avgHealth = Math.max(0, 100 - (totalDecay / topics.length));
    
    let status = 'Stable';
    if (avgHealth < 50) status = 'Critical';
    else if (avgHealth < 80) status = 'Decaying';

    return { health: Math.round(avgHealth), status, oldestTopic };
}

// NEW: Get health stats for ALL individual topics (for visualization)
export function getDetailedTopicHealth(history) {
    const topicDates = getTopicLastPlayedDates(history);
    const now = Date.now();
    const DAY_MS = 86400000;
    
    const results = {};
    
    Object.keys(topicDates).forEach(topic => {
        const daysSince = (now - topicDates[topic]) / DAY_MS;
        let decay = 0;
        if (daysSince > GRACE_PERIOD_DAYS) {
            decay = Math.min(100, (daysSince - GRACE_PERIOD_DAYS) * DECAY_RATE_PER_DAY);
        }
        const health = Math.max(0, 100 - decay);
        let status = 'Stable';
        if (health < 50) status = 'Critical';
        else if (health < 80) status = 'Decaying';
        
        results[topic] = { health: Math.round(health), status, daysSince: Math.floor(daysSince) };
    });
    
    return results;
}
