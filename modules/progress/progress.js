// modules/progress/progress.js

import * as progressService from '../../services/progressService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';
import { ALL_ACHIEVEMENTS } from '../../services/achievementService.js';
import { generateNemesisQuiz } from '../../services/geminiService.js';
import { startQuizFlow } from '../../services/navigationService.js';
import { categoryData } from '../../services/topicService.js';

let sceneManager;
let performanceChart, masteryChart;
let eventListeners = [];

function renderAchievements(unlockedAchievements) {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;

    grid.innerHTML = ALL_ACHIEVEMENTS.map(ach => {
        const isUnlocked = unlockedAchievements.includes(ach.id);
        return `
            <div class="achievement-badge ${isUnlocked ? 'unlocked' : ''}" data-tooltip="${ach.name}: ${ach.description}">
                <span class="badge-icon">${ach.icon}</span>
            </div>
        `;
    }).join('');
}

function handleNemesisQuiz(e) {
    const topicName = e.currentTarget.dataset.topic;
    const concepts = e.currentTarget.dataset.concepts;
    const prompt = generateNemesisQuiz(topicName, concepts);
    
    const quizContext = {
        topicName: `Nemesis: ${topicName}`,
        isLeveled: false,
        prompt: prompt,
        returnHash: '#progress',
        generationType: 'quiz'
    };

    startQuizFlow(quizContext);
}

function renderWeakestConcepts(history) {
    const container = document.getElementById('weakest-concepts-container');
    const loadingEl = document.getElementById('weakest-concepts-loading');
    const conceptsList = document.getElementById('weakest-concepts-list');
    const nemesisContainer = document.getElementById('nemesis-quiz-container');

    if (!container || !conceptsList || !loadingEl || !nemesisContainer) return;

    const allMissed = Object.entries(history)
        .flatMap(([topic, data]) => (data.missedConcepts || []).map(concept => ({ topic, concept })));

    if (allMissed.length === 0) {
        container.innerHTML = `<p>No weaknesses detected yet. Keep challenging yourself!</p>`;
        loadingEl.classList.add('hidden');
        return;
    }

    const conceptCounts = allMissed.reduce((acc, { concept }) => {
        acc[concept] = (acc[concept] || 0) + 1;
        return acc;
    }, {});

    const topMissed = Object.entries(conceptCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([concept]) => concept);

    conceptsList.innerHTML = topMissed.map(concept => `<li>${concept}</li>`).join('');

    const nemesisTopic = allMissed.reduce((acc, { topic }) => {
        acc[topic] = (acc[topic] || 0) + 1;
        return acc;
    }, {});
    const topNemesisTopic = Object.keys(nemesisTopic).length > 0 ? Object.entries(nemesisTopic).sort(([,a],[,b]) => b - a)[0][0] : null;

    if (topNemesisTopic && topMissed.length > 0) {
        nemesisContainer.innerHTML = `<button class="btn nemesis-quiz-btn" data-topic="${topNemesisTopic}" data-concepts="${topMissed.join(', ')}">⚡ Create Targeted Nemesis Quiz on ${topNemesisTopic}</button>`;
        const btn = nemesisContainer.querySelector('button');
        btn.addEventListener('click', handleNemesisQuiz);
        eventListeners.push({ element: btn, type: 'click', handler: handleNemesisQuiz });
    }

    loadingEl.classList.add('hidden');
    container.classList.remove('hidden');
}


function renderPerformanceChart(history) {
    const ctx = document.getElementById('performance-chart')?.getContext('2d');
    if (!ctx) return;
    
    const last30Days = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    const dailyScores = last30Days.reduce((acc, day) => {
        acc[day] = { total: 0, count: 0 };
        return acc;
    }, {});

    Object.values(history).forEach(topicData => {
        (topicData.sessions || []).forEach(session => {
            const day = new Date(session.timestamp).toISOString().split('T')[0];
            if (dailyScores[day]) {
                dailyScores[day].total += session.score;
                dailyScores[day].count++;
            }
        });
    });

    const chartData = last30Days.map(day => {
        const data = dailyScores[day];
        return data.count > 0 ? (data.total / data.count) * 100 : null;
    });

    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last30Days.map(d => new Date(d).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})),
            datasets: [{
                label: 'Average Score',
                data: chartData,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary'),
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-glow'),
                tension: 0.4,
                spanGaps: true,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderMasteryChart(levels) {
    const ctx = document.getElementById('mastery-chart')?.getContext('2d');
    if (!ctx) return;

    const categoryLevels = {};
    for (const categoryKey in categoryData) {
        const category = categoryData[categoryKey];
        categoryLevels[category.categoryTitle] = { total: 0, count: 0 };
        category.topics.forEach(topic => {
            if (levels[topic.name]) {
                categoryLevels[category.categoryTitle].total += levels[topic.name];
                categoryLevels[category.categoryTitle].count++;
            }
        });
    }

    const labels = Object.keys(categoryLevels);
    const data = labels.map(label => {
        const cat = categoryLevels[label];
        return cat.count > 0 ? Math.round(cat.total / cat.count) : 0;
    });

    masteryChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Level',
                data: data,
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-glow'),
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary'),
                borderWidth: 2,
                pointBackgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary'),
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true } } }
    });
}

async function renderProgress() {
    const progressContent = document.getElementById('progress-content');
    try {
        const progress = await progressService.getProgress();
        if (!progress) throw new Error("Could not load your progress data.");

        const { achievements = [], history = {}, levels = {} } = progress;
        
        renderAchievements(achievements);
        renderWeakestConcepts(history);

        // Render charts, now assuming Chart.js is globally available.
        try {
            if (typeof Chart === 'undefined') {
                throw new Error("Chart.js library failed to load.");
            }
            renderPerformanceChart(history);
            renderMasteryChart(levels);
        } catch (e) {
            console.error("Chart rendering failed:", e);
            const pChartContainer = document.getElementById('performance-chart')?.parentElement;
            if (pChartContainer) pChartContainer.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);">Chart failed to load.</p>';
            const mChartContainer = document.getElementById('mastery-chart')?.parentElement;
            if (mChartContainer) mChartContainer.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);">Chart failed to load.</p>';
        }

    } catch (error) {
        console.error("Error rendering progress:", error);
        progressContent.innerHTML = `<div class="no-progress-message" style="color: var(--color-danger);">${error.message} Please try refreshing.</div>`;
    }
}

export async function init() {
    renderProgress();
    sceneManager = initModuleScene('.background-canvas', 'nebula');
}

export function cleanup() {
    eventListeners.forEach(({ element, type, handler }) => element.removeEventListener(type, handler));
    eventListeners = [];
    if (performanceChart) performanceChart.destroy();
    if (masteryChart) masteryChart.destroy();
    sceneManager = cleanupModuleScene(sceneManager);
}