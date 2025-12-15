
import * as historyService from '../../services/historyService.js';
import * as vfxService from '../../services/vfxService.js';
import { showToast } from '../../services/toastService.js';

let elements = {};

function calculateStats() {
    const history = historyService.getHistory().filter(h => h.type === 'quiz');
    
    if (history.length === 0) return null;

    let totalQuestions = 0;
    let totalCorrect = 0;
    let topicMap = {};
    let totalDuration = 0; // Simulated based on questions

    history.forEach(h => {
        totalQuestions += h.totalQuestions;
        totalCorrect += h.score;
        totalDuration += (h.totalQuestions * 0.8); // Est. 45-50 sec per question

        // Topic Aggregation
        const topicName = h.topic.split('-')[0].trim();
        if (!topicMap[topicName]) {
            topicMap[topicName] = { correct: 0, total: 0 };
        }
        topicMap[topicName].correct += h.score;
        topicMap[topicName].total += h.totalQuestions;
    });

    const overallAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    
    // Determine Grade
    let grade = 'F';
    if (overallAccuracy >= 90) grade = 'S';
    else if (overallAccuracy >= 80) grade = 'A';
    else if (overallAccuracy >= 70) grade = 'B';
    else if (overallAccuracy >= 60) grade = 'C';
    else if (overallAccuracy >= 50) grade = 'D';

    const sortedTopics = Object.entries(topicMap).map(([name, data]) => ({
        name,
        accuracy: (data.correct / data.total) * 100,
        count: data.total
    })).sort((a, b) => b.accuracy - a.accuracy);

    return {
        totalQuestions,
        totalCorrect,
        accuracy: Math.round(overallAccuracy),
        grade,
        totalTimeMinutes: Math.round(totalDuration),
        uniqueTopics: Object.keys(topicMap).length,
        topics: sortedTopics
    };
}

function renderReport() {
    const stats = calculateStats();

    if (!stats) {
        document.querySelector('.report-grid-top').style.display = 'none';
        document.querySelector('.chart-section').style.display = 'none';
        document.querySelector('.breakdown-section').innerHTML = '<div class="empty-state" style="padding:2rem;text-align:center;">No data available. Complete missions to generate report.</div>';
        return;
    }

    // 1. Overview
    elements.gradeLetter.textContent = stats.grade;
    elements.gradeLetter.style.color = getGradeColor(stats.grade);
    document.querySelector('.grade-circle').style.borderColor = getGradeColor(stats.grade);

    const hours = Math.floor(stats.totalTimeMinutes / 60);
    const mins = stats.totalTimeMinutes % 60;
    elements.totalTime.textContent = `${hours}h ${mins}m`;
    
    elements.knowledgeIndex.textContent = stats.uniqueTopics;

    // 2. Chart
    elements.totalQuestions.textContent = stats.totalQuestions;
    elements.totalCorrect.textContent = stats.totalCorrect;
    elements.efficiencyRate.textContent = `${stats.accuracy}%`;
    elements.accuracyPercent.textContent = `${stats.accuracy}%`;

    // Animate Chart
    setTimeout(() => {
        const degree = stats.accuracy * 3.6;
        elements.accuracyChart.style.background = `conic-gradient(var(--color-primary) 0deg ${degree}deg, var(--color-surface-hover) ${degree}deg 360deg)`;
    }, 100);

    // 3. Breakdown
    elements.topicBars.innerHTML = '';
    stats.topics.forEach((t, i) => {
        const row = document.createElement('div');
        row.className = 'topic-bar-row';
        row.innerHTML = `
            <div class="topic-label-row">
                <span class="t-name">${t.name}</span>
                <span class="t-val">${Math.round(t.accuracy)}%</span>
            </div>
            <div class="bar-track">
                <div class="bar-fill" style="width: 0%; transition-delay: ${i * 100}ms"></div>
            </div>
        `;
        elements.topicBars.appendChild(row);
        
        // Trigger animation
        setTimeout(() => {
            row.querySelector('.bar-fill').style.width = `${t.accuracy}%`;
        }, 100);
    });
}

function getGradeColor(grade) {
    if (grade === 'S') return '#8b5cf6'; // Purple
    if (grade === 'A') return '#22c55e'; // Green
    if (grade === 'B') return '#3b82f6'; // Blue
    if (grade === 'C') return '#eab308'; // Yellow
    return '#ef4444'; // Red
}

export function init() {
    elements = {
        gradeLetter: document.getElementById('grade-letter'),
        totalTime: document.getElementById('total-time'),
        knowledgeIndex: document.getElementById('knowledge-index'),
        accuracyChart: document.getElementById('accuracy-chart'),
        accuracyPercent: document.getElementById('accuracy-percent'),
        totalQuestions: document.getElementById('total-questions'),
        totalCorrect: document.getElementById('total-correct'),
        efficiencyRate: document.getElementById('efficiency-rate'),
        topicBars: document.getElementById('topic-bars'),
        printBtn: document.getElementById('print-report-btn')
    };

    renderReport();

    elements.printBtn.addEventListener('click', () => {
        showToast("Generating Transcript...");
        setTimeout(() => window.print(), 1000);
    });
}

export function destroy() {}
