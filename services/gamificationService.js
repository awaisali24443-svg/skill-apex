
import { LOCAL_STORAGE_KEYS } from '../constants.js';
import { showToast } from './toastService.js';
import { db, doc, getDoc, setDoc, getUserId, isGuest, updateLeaderboardScore } from './firebaseService.js';

const defaultStats = {
    level: 1,
    xp: 0,
    currentStreak: 0,
    lastQuizDate: null,
    totalQuizzesCompleted: 0, // Explicit tracking
    totalPerfectQuizzes: 0,
    questionsSaved: 0,
    dailyQuests: { date: null, quests: [] },
    dailyChallenge: { date: null, completed: false }
};

let stats = { ...defaultStats };

// --- TIERED ACHIEVEMENT DEFINITIONS ---
const ACHIEVEMENTS = {
    scholar: { 
        name: "Scholar", 
        description: "Complete learning missions.", 
        icon: "book",
        metric: (s) => s.totalQuizzesCompleted,
        tiers: [
            { name: 'Bronze', target: 10, color: '#cd7f32' },
            { name: 'Silver', target: 50, color: '#c0c0c0' },
            { name: 'Gold', target: 100, color: '#ffd700' },
            { name: 'Diamond', target: 500, color: '#b9f2ff' }
        ]
    },
    streak_master: { 
        name: "Consistency", 
        description: "Maintain a daily learning streak.", 
        icon: "zap", 
        metric: (s) => s.currentStreak,
        tiers: [
            { name: 'Bronze', target: 3, color: '#cd7f32' },
            { name: 'Silver', target: 7, color: '#c0c0c0' },
            { name: 'Gold', target: 30, color: '#ffd700' },
            { name: 'Diamond', target: 100, color: '#b9f2ff' }
        ]
    },
    perfectionist: { 
        name: "Sniper", 
        description: "Finish quizzes with 100% accuracy.", 
        icon: "target", 
        metric: (s) => s.totalPerfectQuizzes,
        tiers: [
            { name: 'Bronze', target: 1, color: '#cd7f32' },
            { name: 'Silver', target: 10, color: '#c0c0c0' },
            { name: 'Gold', target: 50, color: '#ffd700' },
            { name: 'Diamond', target: 100, color: '#b9f2ff' }
        ]
    },
    librarian: { 
        name: "Librarian", 
        description: "Save questions to your library.", 
        icon: "archive", 
        metric: (s) => s.questionsSaved, // Needs to be updated manually
        tiers: [
            { name: 'Bronze', target: 5, color: '#cd7f32' },
            { name: 'Silver', target: 20, color: '#c0c0c0' },
            { name: 'Gold', target: 100, color: '#ffd700' },
            { name: 'Diamond', target: 500, color: '#b9f2ff' }
        ]
    },
    veteran: {
        name: "XP Hunter",
        description: "Gain total Experience Points.",
        icon: "star",
        metric: (s) => s.xp,
        tiers: [
            { name: 'Bronze', target: 1000, color: '#cd7f32' },
            { name: 'Silver', target: 5000, color: '#c0c0c0' },
            { name: 'Gold', target: 20000, color: '#ffd700' },
            { name: 'Diamond', target: 100000, color: '#b9f2ff' }
        ]
    }
};

const QUEST_TYPES = [
    { id: 'complete_level', text: 'Complete 1 Level', xp: 50, check: (action) => action.type === 'complete_level' },
    { id: 'perfect_score', text: 'Get 100% on a Quiz', xp: 100, check: (action) => action.type === 'complete_level' && action.data.scorePercent === 1 },
    { id: 'use_hint', text: 'Use a Hint', xp: 20, check: (action) => action.type === 'use_hint' },
    { id: 'save_question', text: 'Save a Question', xp: 30, check: (action) => action.type === 'save_question' },
    { id: 'study_session', text: 'Review Flashcards', xp: 40, check: (action) => action.type === 'study_session' },
];

async function loadStats() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION);
        const storedData = stored ? JSON.parse(stored) : {};
        
        // Merge with default to ensure new fields (like totalQuizzesCompleted) exist
        stats = { ...defaultStats, ...storedData };
        
        checkDailyQuests();

        if (navigator.onLine && !isGuest()) {
            const userId = getUserId();
            if (userId) {
                const docRef = doc(db, "users", userId, "data", "gamification");
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const remoteStats = docSnap.data();
                    if (remoteStats.xp > stats.xp) {
                        stats = { ...stats, ...remoteStats };
                        saveStatsLocal();
                        window.dispatchEvent(new CustomEvent('gamification-updated'));
                    }
                }
                updateLeaderboardScore(stats);
            }
        }
    } catch (e) {
        console.error("Failed to load gamification stats:", e);
        stats = { ...defaultStats };
    }
}

function saveStats() {
    saveStatsLocal();
    saveStatsRemote();
    window.dispatchEvent(new CustomEvent('gamification-updated'));
}

function saveStatsLocal() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.GAMIFICATION, JSON.stringify(stats));
    } catch (e) {
        console.error("Failed to save gamification stats locally:", e);
    }
}

async function saveStatsRemote() {
    if (!navigator.onLine || isGuest()) return;
    try {
        const userId = getUserId();
        if (userId) {
            await setDoc(doc(db, "users", userId, "data", "gamification"), stats);
            updateLeaderboardScore(stats);
        }
    } catch (e) {
        console.warn("Failed to save stats to cloud", e);
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
    
    // 1. Update Internal Counts based on action
    if (action.type === 'complete_level') {
        stats.totalQuizzesCompleted = (stats.totalQuizzesCompleted || 0) + 1;
        if (action.data.scorePercent === 1) stats.totalPerfectQuizzes = (stats.totalPerfectQuizzes || 0) + 1;
        questUpdated = true;
    }
    if (action.type === 'save_question') {
        stats.questionsSaved = (stats.questionsSaved || 0) + 1;
        questUpdated = true;
    }

    // 2. Check Daily Quests
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
    
    // Updates internal counters inside checkQuestProgress
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

    saveStats();
}

/**
 * Returns full achievement data including current tier status.
 */
export function getAchievementsProgress() {
    return Object.entries(ACHIEVEMENTS).map(([id, data]) => {
        const currentValue = data.metric(stats) || 0;
        
        let currentTier = null;
        let nextTier = data.tiers[0];
        let progress = 0;
        let target = data.tiers[0].target;
        let isMaxed = false;

        // Determine Tier
        for (let i = 0; i < data.tiers.length; i++) {
            const tier = data.tiers[i];
            if (currentValue >= tier.target) {
                currentTier = tier;
                if (i < data.tiers.length - 1) {
                    nextTier = data.tiers[i + 1];
                    target = nextTier.target;
                } else {
                    isMaxed = true;
                    nextTier = null;
                    target = currentValue; // Cap it
                }
            } else {
                nextTier = tier;
                target = tier.target;
                break;
            }
        }

        // Calculate Progress Percentage to Next Tier
        if (isMaxed) {
            progress = 100;
        } else {
            const prevTarget = currentTier ? currentTier.target : 0;
            // Progress within the current band
            const bandTotal = target - prevTarget;
            const bandCurrent = currentValue - prevTarget;
            progress = Math.max(0, Math.min(100, (bandCurrent / bandTotal) * 100));
        }

        return {
            id,
            name: data.name,
            description: data.description,
            icon: data.icon,
            currentValue,
            target,
            progressPercent: progress,
            currentTierName: currentTier ? currentTier.name : 'Locked',
            currentTierColor: currentTier ? currentTier.color : '#444',
            nextTierName: nextTier ? nextTier.name : 'Max',
            isUnlocked: !!currentTier,
            isMaxed
        };
    });
}

export function getProfileStats(history) {
    const totalQuizzes = history.length;
    const totalQuestions = history.reduce((sum, item) => sum + item.totalQuestions, 0);
    const totalCorrect = history.reduce((sum, item) => sum + item.score, 0);
    const averageScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    
    return { totalQuizzes, totalQuestions, averageScore };
}

// Memory Health helpers remain the same...
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
