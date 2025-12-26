
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
    fastAnswersCount: 0, 
    nightOwlSessions: 0, 
    totalAuralMinutes: 0,
    uniqueTopicsPlayed: [],
    
    dailyQuests: { date: null, quests: [] },
    dailyChallenge: { date: null, completed: false }
};

let stats = { ...defaultStats };

// --- ACHIEVEMENTS: RE-ALIGNED FOR PUBLIC IMPACT ---
const ACHIEVEMENTS = {
    scholar: { 
        name: "Constituency Lead", 
        description: "Complete educational missions for the community.", 
        icon: "book",
        metric: (s) => s.totalQuizzesCompleted,
        tiers: [{ target: 5 }, { target: 25 }, { target: 100 }]
    },
    streak_master: { 
        name: "Public Service", 
        description: "Maintain daily consistency in training.", 
        icon: "zap", 
        metric: (s) => s.currentStreak,
        tiers: [{ target: 3 }, { target: 7 }, { target: 30 }]
    },
    audiophile: {
        name: "Voice Link",
        description: "Mastery through verbal AI interaction.",
        icon: "headphones",
        metric: (s) => s.totalAuralMinutes || 0,
        tiers: [{ target: 15 }, { target: 60 }, { target: 300 }]
    },
    polymath: {
        name: "Sector Specialist",
        description: "Excellence across multiple industrial domains.",
        icon: "globe",
        metric: (s) => s.uniqueTopicsPlayed?.length || 0,
        tiers: [{ target: 3 }, { target: 8 }, { target: 20 }]
    },
    executive: {
        name: "Patriot",
        description: "View the Provincial Development Briefing.",
        icon: "star",
        metric: (s) => s.viewedBriefing ? 1 : 0,
        tiers: [{ target: 1 }]
    }
};

const QUEST_TYPES = [
    { id: 'complete_level', text: 'Finish 1 Training Module', xp: 50, check: (action) => action.type === 'complete_level' },
    { id: 'perfect_score', text: 'Achieve 100% Efficiency', xp: 100, check: (action) => action.type === 'complete_level' && action.data.scorePercent === 1 },
    { id: 'use_hint', text: 'Optimize Knowledge Search', xp: 20, check: (action) => action.type === 'use_hint' },
    { id: 'save_question', text: 'Archive Critical Data', xp: 30, check: (action) => action.type === 'save_question' },
    { id: 'study_session', text: 'Review Community Archives', xp: 40, check: (action) => action.type === 'study_session' },
];

async function loadStats() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.GAMIFICATION);
        stats = { ...defaultStats, ...JSON.parse(stored || '{}') };
        checkDailyQuests();
        if (navigator.onLine && !isGuest()) {
            const userId = getUserId();
            if (userId) {
                const docSnap = await getDoc(doc(db, "users", userId, "data", "gamification"));
                if (docSnap.exists()) {
                    const remote = docSnap.data();
                    if (remote.xp > stats.xp) { stats = { ...stats, ...remote }; saveStatsLocal(); }
                }
                updateLeaderboardScore(stats);
            }
        }
    } catch (e) { console.error(e); }
}

function saveStats() {
    saveStatsLocal();
    saveStatsRemote();
    window.dispatchEvent(new CustomEvent('gamification-updated'));
}

function saveStatsLocal() { localStorage.setItem(LOCAL_STORAGE_KEYS.GAMIFICATION, JSON.stringify(stats)); }
async function saveStatsRemote() {
    if (!navigator.onLine || isGuest()) return;
    const userId = getUserId();
    if (userId) {
        await setDoc(doc(db, "users", userId, "data", "gamification"), stats);
        updateLeaderboardScore(stats);
    }
}

function checkDailyQuests() {
    const today = new Date().toDateString();
    if (stats.dailyQuests.date !== today) {
        const shuffled = [...QUEST_TYPES].sort(() => 0.5 - Math.random());
        stats.dailyQuests = { date: today, quests: shuffled.slice(0, 3).map(q => ({ ...q, completed: false })) };
        stats.dailyChallenge = { date: today, completed: false };
        saveStats();
    }
}

export function checkQuestProgress(action) {
    let updated = false;
    if (action.type === 'complete_level') {
        stats.totalQuizzesCompleted = (stats.totalQuizzesCompleted || 0) + 1;
        if (action.data.topic) {
            const topicName = action.data.topic.split('-')[0].trim();
            if (!stats.uniqueTopicsPlayed.includes(topicName)) stats.uniqueTopicsPlayed.push(topicName);
        }
        updated = true;
    }
    if (action.type === 'view_briefing') { stats.viewedBriefing = true; updated = true; }
    if (action.type === 'aural_session') { stats.totalAuralMinutes = (stats.totalAuralMinutes || 0) + Math.ceil(action.data.duration / 60); updated = true; }
    
    stats.dailyQuests.quests.forEach(q => {
        if (!q.completed) {
            const def = QUEST_TYPES.find(t => t.id === q.id);
            if (def && def.check(action)) { q.completed = true; stats.xp += def.xp; showToast(`Metric Unlocked: ${def.text}`, 'success'); updated = true; }
        }
    });
    if (updated) saveStats();
}

export function init() { loadStats(); }
export function getStats() { return { ...stats }; }
export function getDailyQuests() { return stats.dailyQuests.quests; }
export function getXpForNextLevel(level) { return level * 100; }

export function updateStatsOnQuizCompletion(quizAttempt) {
    const today = new Date();
    stats.lastQuizDate = today.toISOString();
    stats.xp += (quizAttempt.xpGained || 0);
    checkQuestProgress({ type: 'complete_level', data: { scorePercent: quizAttempt.score/quizAttempt.totalQuestions, topic: quizAttempt.topic } });
    
    let xpNext = getXpForNextLevel(stats.level);
    while (stats.xp >= xpNext) { stats.level++; stats.xp -= xpNext; xpNext = getXpForNextLevel(stats.level); window.dispatchEvent(new CustomEvent('level-up', { detail: { level: stats.level } })); }
    saveStats();
}

export function getAchievementsProgress() {
    return Object.entries(ACHIEVEMENTS).map(([id, data]) => {
        const val = data.metric(stats) || 0;
        let tier = null, target = data.tiers[0].target, progress = 0;
        for (let i = 0; i < data.tiers.length; i++) {
            if (val >= data.tiers[i].target) { tier = data.tiers[i]; if (i < data.tiers.length - 1) target = data.tiers[i+1].target; else target = val; }
            else { target = data.tiers[i].target; break; }
        }
        if (val >= data.tiers[data.tiers.length-1].target) progress = 100;
        else { const prev = tier ? tier.target : 0; progress = Math.max(0, Math.min(100, ((val - prev) / (target - prev)) * 100)); }
        return { id, name: data.name, description: data.description, icon: data.icon, currentValue: val, target, progressPercent: progress, isUnlocked: !!tier, isMaxed: val >= data.tiers[data.tiers.length-1].target };
    });
}
