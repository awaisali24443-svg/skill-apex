import * as auth from '../../services/authService.js';
import * as progress from '../../services/progressService.js';
import * as missions from '../../services/missionService.js';
import * as learning from '../../services/learningPathService.js';
import { generateLearningPath } from '../../services/geminiService.js';
import { StellarMap } from '../../services/stellarMap.js';
import { startQuizFlow } from '../../services/navigationService.js';
import { categoryData } from '../../services/topicService.js';
import { NUM_QUESTIONS } from '../../constants.js';
import { loadThreeJS } from '../../services/libraryLoader.js';
import { showToast } from '../../services/uiService.js';


let stellarMap;

async function renderDashboard() {
    const user = auth.getCurrentUser();
    if (!user) return; // Should not happen if routed correctly, but as a safeguard.
    const userProgress = await progress.getProgress();
    
    document.getElementById('welcome-message').textContent = `Welcome, ${user.displayName || 'Agent'}!`;
    document.getElementById('player-name').textContent = user.displayName || 'Guest';

    const { level, xpInLevel, xpForNextLevel } = progress.calculateLevel(userProgress.totalXp);
    document.getElementById('player-level').textContent = `LVL ${level}`;
    document.getElementById('player-xp-bar').style.width = `${(xpInLevel / xpForNextLevel) * 100}%`;
    document.getElementById('player-xp-text').textContent = `${xpInLevel} / ${xpForNextLevel} XP`;
    document.getElementById('player-streak').textContent = `${userProgress.streak || 0} Day Streak`;

    renderMissions();
    renderLearningPaths();
    renderStreakCalendar(userProgress.streakDates || []);
}

async function renderMissions() {
    const list = document.getElementById('missions-list');
    if (!list) return;
    const missionsData = await missions.getMissions();
    if (missionsData.missions.length > 0) {
        list.innerHTML = missionsData.missions.map(m => `
            <div class="mission-item">${m.text} (${m.progress}/${m.target})</div>
        `).join('');
    } else {
        list.innerHTML = `<p>No missions available right now.</p>`;
    }
}

async function renderLearningPaths() {
    const list = document.getElementById('learning-paths-list');
    if (!list) return;
    const paths = await learning.getActiveLearningPaths();

    if (paths.length > 0) {
        list.innerHTML = paths.map(p => `<div><a href="#learning-path" data-path-id="${p.id}">${p.title}</a></div>`).join('');
        list.querySelectorAll('a').forEach(a => a.addEventListener('click', (e) => {
            sessionStorage.setItem('moduleContext', JSON.stringify({ pathId: e.target.dataset.pathId }));
        }));
    } else {
        list.innerHTML = `<p>Use the AI Planner to create a new learning path!</p>`;
    }
}

function renderStreakCalendar(streakDates) {
    const calendar = document.getElementById('streak-calendar');
    if (!calendar) return;
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

async function handleRandomChallenge() {
    const allTopics = Object.values(categoryData).flatMap(cat => cat.topics);
    if (allTopics.length === 0) {
        window.showToast("No topics available for a random challenge.", "error");
        return;
    }
    const randomIndex = Math.floor(Math.random() * allTopics.length);
    const topicName = allTopics[randomIndex].name;
    
    startRecommendedQuiz(topicName, `A quiz on a surprise topic: ${topicName}`);
}

function startRecommendedQuiz(topicName, customTitle = null) {
    const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topicName}". The difficulty should be Medium.`;
    const quizContext = { topicName: customTitle || topicName, isLeveled: false, prompt, returnHash: '#home', generationType: 'quiz' };
    startQuizFlow(quizContext);
}

async function handleLearningPathSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const input = form.querySelector('#learning-goal-input');
    const button = form.querySelector('button[type="submit"]');
    const goal = input.value.trim();

    if (!goal) {
        showToast('Please enter a learning goal.', 'error');
        return;
    }
    
    const originalContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<div class="spinner"></div>';

    try {
        const pathData = await generateLearningPath(goal);
        await learning.saveLearningPath(pathData);
        showToast('New learning path created!', 'success');
        input.value = '';
        await renderLearningPaths();
    } catch (error) {
        console.error('Failed to generate learning path:', error);
        showToast(error.message, 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = originalContent;
    }
}

export async function init() {
    await renderDashboard();
    document.getElementById('random-challenge-btn')?.addEventListener('click', handleRandomChallenge);
    document.getElementById('learning-path-form')?.addEventListener('submit', handleLearningPathSubmit);

    const canvas = document.getElementById('stellar-map-canvas');
    const loadingOverlay = document.getElementById('stellar-map-loading');
    
    // Check user setting for 3D backgrounds
    const settings = JSON.parse(localStorage.getItem('generalSettings') || '{}');
    const enable3d = settings['enable-3d'] === true; // default to false if not set

    if (enable3d) {
        try {
            await loadThreeJS();
            stellarMap = new StellarMap(canvas);
            await stellarMap.init();

        } catch(error) {
            console.error("Failed to initialize StellarMap:", error);
            if (canvas) canvas.style.display = 'none';
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
            
            const dashboardContainer = document.querySelector('.dashboard-container');
            if (dashboardContainer) {
                dashboardContainer.classList.add('map-failed');
            }

            showToast('3D map component failed to load. Displaying static background.', 'warning');
        }
    } else {
        // 3D is disabled, apply fallback styles immediately
        console.log('StellarMap disabled by user setting.');
        if (canvas) canvas.style.display = 'none';
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        const dashboardContainer = document.querySelector('.dashboard-container');
        if (dashboardContainer) {
            dashboardContainer.classList.add('map-failed');
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