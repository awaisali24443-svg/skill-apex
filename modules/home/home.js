import * as auth from '../../services/authService.js';
import * as progress from '../../services/progressService.js';
import * as missions from '../../services/missionService.js';
import * as learning from '../../services/learningPathService.js';
import * as activity from '../../services/activityFeedService.js';
import { StellarMap } from '../../services/stellarMap.js';
import { startQuizFlow } from '../../services/navigationService.js';
import { categoryData } from '../../services/topicService.js';
import { NUM_QUESTIONS, MAX_LEVEL } from '../../constants.js';


let stellarMap;

async function renderDashboard() {
    const user = auth.getCurrentUser();
    const userProgress = await progress.getProgress();
    
    document.getElementById('welcome-message').textContent = `Welcome, ${user.displayName || 'Agent'}!`;
    document.getElementById('player-name').textContent = user.displayName || 'Guest';

    const { level, xpInLevel, xpForNextLevel } = progress.calculateLevel(userProgress.totalXp);
    document.getElementById('player-level').textContent = `LVL ${level}`;
    document.getElementById('player-xp-bar').style.width = `${(xpInLevel / xpForNextLevel) * 100}%`;
    document.getElementById('player-xp-text').textContent = `${xpInLevel} / ${xpForNextLevel} XP`;
    document.getElementById('player-streak').textContent = `${userProgress.streak || 0} Day Streak`;

    renderMissions();
    renderRecommendations();
    renderStreakCalendar(userProgress.streakDates || []);
    renderLearningPaths();

    if (auth.isGuest()) {
        const liveChallengeCard = document.querySelector('a[href="#challenge-lobby"]');
        if (liveChallengeCard) {
            liveChallengeCard.outerHTML = `<div class="action-card disabled"><span class="action-icon">🤝</span><h3>Live Challenge</h3><p>Sign up to compete!</p></div>`;
        }
        document.getElementById('activity-feed-section').innerHTML = `<h2>🛰️ Activity Feed</h2><p>Sign up to see community activity!</p>`;
    } else {
        renderActivityFeed();
    }
}

async function renderMissions() {
    const missionsData = await missions.getMissions();
    const list = document.getElementById('missions-list');
    list.innerHTML = missionsData.missions.map(m => `
        <div class="mission-item">${m.text} (${m.progress}/${m.target})</div>
    `).join('');
}

async function renderRecommendations() {
    const list = document.getElementById('recommendations-list');
    const weakestTopics = await progress.getWeakestTopics(3);

    if (weakestTopics.length === 0) {
        list.innerHTML = `<p>No specific weaknesses detected. Keep up the great work!</p>`;
        return;
    }

    list.innerHTML = weakestTopics.map(topicName => `
        <div class="recommendation-card">
            <h4>Focus on: ${topicName}</h4>
            <div class="recommendation-actions">
                <button class="btn btn-secondary study-btn" data-topic-name="${topicName}">Study</button>
                <button class="btn btn-primary quiz-btn" data-topic-name="${topicName}">Quiz</button>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.quiz-btn').forEach(btn => btn.addEventListener('click', (e) => startRecommendedQuiz(e.target.dataset.topicName)));
    list.querySelectorAll('.study-btn').forEach(btn => btn.addEventListener('click', (e) => startRecommendedStudy(e.target.dataset.topicName)));
}


function renderStreakCalendar(streakDates) {
    const calendar = document.getElementById('streak-calendar');
    const today = new Date();
    let calendarHtml = '';
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        const dayLetter = date.toLocaleDateString(undefined, { weekday: 'short' }).charAt(0);
        const isActive = streakDates.includes(dateString);
        calendarHtml += `<div class="streak-day ${isActive ? 'active' : ''}">${dayLetter}</div>`;
    }
    calendar.innerHTML = calendarHtml;
}

async function renderLearningPaths() {
    const paths = await learning.getActiveLearningPaths();
    // For brevity, we'll just show a count or link to the first one
    const list = document.getElementById('learning-paths-list');
    if (paths.length > 0) {
        list.innerHTML = paths.map(p => `<div><a href="#learning-path" data-path-id="${p.id}">${p.title}</a></div>`).join('');
        list.querySelectorAll('a').forEach(a => a.addEventListener('click', (e) => {
            sessionStorage.setItem('moduleContext', JSON.stringify({ pathId: e.target.dataset.pathId }));
        }));
    } else {
        list.innerHTML = `<p>No active learning paths.</p>`;
    }
}

async function renderActivityFeed() {
    const feed = await activity.getRecentActivities();
    const list = document.getElementById('activity-feed-list');
    if (feed.length > 0) {
        list.innerHTML = feed.map(item => `<div class="activity-item">${item.icon} <strong>${item.username}</strong> ${item.text}</div>`).join('');
    } else {
        list.innerHTML = `<p>No recent activity.</p>`;
    }
}

async function handleRandomChallenge() {
    let topicName = "a random topic"; // Default
    const weakestTopics = await progress.getWeakestTopics(1);

    if (weakestTopics.length > 0) {
        topicName = weakestTopics[0];
    } else {
        // Pick a truly random topic if no weak ones
        const allTopics = Object.values(categoryData).flatMap(cat => cat.topics);
        if (allTopics.length > 0) {
            const randomIndex = Math.floor(Math.random() * allTopics.length);
            topicName = allTopics[randomIndex].name;
        }
    }
    
    startRecommendedQuiz(topicName, `A quiz on a surprise topic: ${topicName}`);
}

function startRecommendedQuiz(topicName, customTitle = null) {
    const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topicName}". The difficulty should be Medium.`;
    const quizContext = { topicName: customTitle || topicName, isLeveled: false, prompt, returnHash: '#home', generationType: 'quiz' };
    startQuizFlow(quizContext);
}

function startRecommendedStudy(topicName) {
    const prompt = `Generate a concise study guide about "${topicName}". The guide should be easy to understand for a beginner, using clear headings, bullet points, and bold text for key terms.`;
    const quizContext = { topicName, returnHash: '#home', isLeveled: false, prompt, generationType: 'study' };
    startQuizFlow(quizContext);
}

export async function init() {
    await renderDashboard();
    
    document.getElementById('random-challenge-btn')?.addEventListener('click', handleRandomChallenge);

    const canvas = document.getElementById('stellar-map-canvas');
    const loadingOverlay = document.getElementById('stellar-map-loading');

    if(canvas && window.THREE) {
        stellarMap = new StellarMap(canvas);
        await stellarMap.init(); // This method handles its own loading state internally
    } else {
        // If THREE.js is missing or canvas isn't found, handle it gracefully.
        console.warn("Stellar map could not be initialized. THREE.js might be missing or blocked.");
        if (canvas) canvas.style.display = 'none'; // Hide the canvas element
        if (loadingOverlay) {
            // Update the loading message to an informative error message.
            loadingOverlay.innerHTML = `<p style="color:var(--color-warning); text-align:center;">3D map component failed to load.<br>The dashboard remains fully functional.</p>`;
        }
    }
    
    // Signal that the module is fully loaded and ready to be displayed.
    document.dispatchEvent(new CustomEvent('moduleReady'));
}

export function cleanup() {
    if(stellarMap) {
        stellarMap.destroy();
        stellarMap = null;
    }
}