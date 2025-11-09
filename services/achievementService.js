import * as progressService from './progressService.js';
import { MAX_LEVEL } from '../constants.js';

export const ALL_ACHIEVEMENTS = [
    {
        id: 'first_quiz',
        name: 'First Steps',
        description: 'Complete your first quiz.',
        icon: '🎓',
        check: (progress) => progress.stats.totalQuizzes >= 1
    },
    {
        id: 'perfect_score',
        name: 'Perfectionist',
        description: 'Get a perfect score on any quiz.',
        icon: '🎯',
        check: (progress, context, score) => score === 5 // Assuming 5 questions
    },
    {
        id: 'level_10',
        name: 'Adept Learner',
        description: 'Reach player level 10.',
        icon: '🧠',
        check: (progress) => progressService.calculateLevelInfo(progress.stats.xp).level >= 10
    },
    {
        id: 'topic_master',
        name: 'Topic Master',
        description: 'Master your first topic by reaching the max level.',
        icon: '🌟',
        check: (progress, context) => progress.levels[context.topicName] >= MAX_LEVEL
    },
    {
        id: 'category_master_science',
        name: 'Scientist',
        description: 'Master all topics in the Science category.',
        icon: '🔬',
        check: (progress) => {
            const scienceTopics = ['Biology', 'Chemistry', 'Physics', 'Science Inventions'];
            return scienceTopics.every(topic => progress.levels[topic] >= MAX_LEVEL);
        }
    },
     {
        id: 'category_master_programming',
        name: 'Code Master',
        description: 'Master all topics in the Programming category.',
        icon: '💻',
        check: (progress) => {
            const programmingTopics = ["Python", "JavaScript", "Java", "SQL", "TypeScript", "C++"];
            return programmingTopics.every(topic => progress.levels[topic] >= MAX_LEVEL);
        }
    },
    {
        id: 'quiz_streak_3',
        name: 'On a Roll',
        description: 'Maintain a 3-day quiz streak.',
        icon: '🔥',
        check: (progress) => progress.stats.streak >= 3
    },
    {
        id: 'explorer',
        name: 'Explorer',
        description: 'Complete a quiz in every category.',
        icon: '🗺️',
        check: (progress) => {
            const completedCategories = new Set(Object.keys(progress.levels).map(topic => {
                for (const catKey in progressService.categoryData) {
                    if (progressService.categoryData[catKey].topics.some(t => t.name === topic)) {
                        return catKey;
                    }
                }
                return null;
            }));
            return completedCategories.size >= Object.keys(progressService.categoryData).length;
        }
    }
];

/**
 * Checks the user's progress against all achievements and unlocks any new ones.
 * @param {object} progress - The updated user progress object.
 * @param {object} quizContext - The context of the quiz that was just completed.
 * @param {number} score - The score from the completed quiz.
 * @returns {Array<object>} - An array of newly unlocked achievement objects.
 */
export function checkAchievements(progress, quizContext, score) {
    const newAchievements = [];

    for (const achievement of ALL_ACHIEVEMENTS) {
        if (!progress.achievements.includes(achievement.id)) {
            if (achievement.check(progress, quizContext, score)) {
                if (progressService.unlockAchievement(achievement.id)) {
                    newAchievements.push(achievement);
                }
            }
        }
    }
    
    return newAchievements;
}