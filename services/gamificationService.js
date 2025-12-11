
import { LOCAL_STORAGE_KEYS } from '../constants.js';
import { showToast } from './toastService.js';
import { db, doc, getDoc, setDoc, getUserId, isGuest, updateLeaderboardScore } from './firebaseService.js';

const defaultStats = {
    level: 1,
    xp: 0,
    currentStreak: 0,
    lastQuizDate: null,
    totalQuizzesCompleted: 0,
    totalPerfectQuizzes: 0,
    questionsSaved: 0,
    // New Metrics
    fastAnswersCount: 0, // Answered in < 5s
    nightOwlSessions: 0, // Completed between 10PM - 4AM
    totalAuralMinutes: 0,
    uniqueTopicsPlayed: [], // Array of strings
    
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
        metric: (s) => s.questionsSaved,
        tiers: [
            { name: 'Bronze', target: 5, color: '#cd7f32' },
            { name: 'Silver', target: 20, color: '#c0c0c0' },
            { name: 'Gold', target: 100, color: '#ffd700' },
            { name: 'Diamond', target: 500, color: '#b9f2ff' }
        ]
    },
    speed_demon: {
        name: "Speed Demon",
        description: "Answer questions in under 5 seconds.",
        icon: "clock",
        metric: (s) => s.fastAnswersCount || 0,
        tiers: [
            { name: 'Bronze', target: 10, color: '#cd7f32' },
            { name: 'Silver', target: 50, color: '#c0c0c0' },
            { name: 'Gold', target: 200, color: '#ffd700' },
            { name: 'Diamond', target: 1000, color: '#b9f2ff' }
        ]
    },
    night_owl: {
        name: "Night Owl",
        description: "Complete sessions late at night (10 PM - 4 AM).",
        icon: "moon",
        metric: (s) => s.nightOwlSessions || 0,
        tiers: [
            { name: 'Bronze', target: 3, color: '#cd7f32' },
            { name: 'Silver', target: 10, color: '#c0c0c0' },
            { name: 'Gold', target: 50, color: '#ffd700' },
            { name: 'Diamond', target: 100, color: '#b9f2ff' }
        ]
    },
    audiophile: {
        name: "Audiophile",
        description: "Minutes spent learning with AI Voice.",
        icon: "headphones",
        metric: (s) => s.totalAuralMinutes || 0,
        tiers: [
            { name: 'Bronze', target: 10, color: '#cd7f32' },
            { name: 'Silver', target: 60, color: '#c0c0c0' },
            { name: 'Gold', target: 300, color: '#ffd700' },
            { name: 'Diamond', target: 1000, color: '#b9f2ff' }
        ]
    },
    polymath: {
        name: "Polymath",
        description: "Explore unique topics.",
        icon: "globe",
        metric: (s) => s.uniqueTopicsPlayed ? s.uniqueTopicsPlayed.length : 0,
        tiers: [
            { name: 'Bronze', target: 3, color: '#cd7f32' },
            { name: 'Silver', target: 5, color: '#c0c0c0' },
            { name: 'Gold', target: 10, color: '#ffd700' },
            { name: 'Diamond', target: 20, color: '#b9f2ff' }
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
    { id: 'speedy', text: '3 Fast Answers (<5s)', xp: 60, check: (action) => action.type === 'fast_answers' && action.data.count >= 3 },
];

async function loadStats() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION);
        const storedData = stored ? JSON.parse(stored) : {};
        
        // Merge to ensure new fields are initialized
        stats = { ...defaultStats, ...storedData };
        
        // Ensure array initialization for new users or migration
        if (!Array.isArray(stats.uniqueTopicsPlayed)) stats.uniqueTopicsPlayed = [];

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
        
        // Track Polymath (Unique Topics)
        if (action.data.topic) {
            const topicName = action.data.topic.split('-')[0].trim();
            if (!stats.uniqueTopicsPlayed.includes(topicName)) {
                stats.uniqueTopicsPlayed.push(topicName);
            }
        }

        // Track Night Owl
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 4) {
            stats.nightOwlSessions = (stats.nightOwlSessions || 0) + 1;
        }

        questUpdated = true;
    }
    
    if (action.type === 'save_question') {
        stats.questionsSaved = (stats.questionsSaved || 0) + 1;
        questUpdated = true;
    }

    if (action.type === 'fast_answers') {
        stats.fastAnswersCount = (stats.fastAnswersCount || 0) + action.data.count;
        questUpdated = true;
    }

    if (action.type === 'aural_session') {
        stats.totalAuralMinutes = (stats.totalAuralMinutes || 0) + Math.ceil(action.data.duration / 60);
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

export function updateStatsOnQuizCompletion(quizAttempt) {
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
    checkQuestProgress({ 
        type: 'complete_level', 
        data: { 
            scorePercent,
            topic: quizAttempt.topic
        } 
    });
    
    // Pass fast answers to counter
    if (quizAttempt.fastAnswers > 0) {
        checkQuestProgress({
            type: 'fast_answers',
            data: { count: quizAttempt.fastAnswers }
        });
    }

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

export function getAchievementsProgress() {
    return Object.entries(ACHIEVEMENTS).map(([id, data]) => {
        const currentValue = data.metric(stats) || 0;
        
        let currentTier = null;
        let nextTier = data.tiers[0];
        let progress = 0;
        let target = data.tiers[0].target;
        let isMaxed = false;

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
                    target = currentValue;
                }
            } else {
                nextTier = tier;
                target = tier.target;
                break;
            }
        }

        if (isMaxed) {
            progress = 100;
        } else {
            const prevTarget = currentTier ? currentTier.target : 0;
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
