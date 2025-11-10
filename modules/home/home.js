import * as auth from '../../services/authService.js';
import * as progress from '../../services/progressService.js';
import * as missions from '../../services/missionService.js';
import * as learning from '../../services/learningPathService.js';
import * as activity from '../../services/activityFeedService.js';
import { StellarMap } from '../../services/stellarMap.js';

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
    renderStreakCalendar(userProgress.streakDates || []);
    renderLearningPaths();

    if (auth.isGuest()) {
        document.getElementById('live-challenge-card-container').innerHTML = `<div class="action-card disabled"><span class="action-icon">🤝</span><h3>Live Challenge</h3><p>Sign up to compete!</p></div>`;
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

export async function init() {
    await renderDashboard();
    const canvas = document.getElementById('stellar-map-canvas');
    if(canvas && window.THREE) {
        stellarMap = new StellarMap(canvas);
        await stellarMap.init();
    }
}

export function cleanup() {
    if(stellarMap) {
        stellarMap.destroy();
        stellarMap = null;
    }
}