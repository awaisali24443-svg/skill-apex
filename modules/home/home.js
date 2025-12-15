
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';

let elements = {};

function updateGreeting() {
    const hour = new Date().getHours();
    let timeGreeting = "Good Morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good Afternoon";
    else if (hour >= 17) timeGreeting = "Good Evening";

    const userName = firebaseService.getUserName() || 'Agent';
    if (elements.greeting) elements.greeting.textContent = `${timeGreeting}, ${userName}`;
}

function updateHUD() {
    const stats = gamificationService.getStats();
    if(elements.levelDisplay) elements.levelDisplay.textContent = stats.level;
    if(elements.streakDisplay) elements.streakDisplay.textContent = stats.currentStreak;
}

function renderResumeCard() {
    const journeys = learningPathService.getAllJourneys();
    const container = document.getElementById('resume-section');
    
    if (!journeys || journeys.length === 0) {
        if (container) container.style.display = 'none';
        return;
    }

    const activeJourney = journeys[0]; 
    const progressPercent = Math.round(((activeJourney.currentLevel - 1) / activeJourney.totalLevels) * 100);

    if (container) {
        container.innerHTML = `
            <div class="card mission-card interactive">
                <div class="mission-info">
                    <h4>CURRENT MISSION</h4>
                    <h3>${activeJourney.goal}</h3>
                    <div class="mission-meta">Level ${activeJourney.currentLevel} • ${progressPercent}% Complete</div>
                </div>
                <button class="btn btn-primary" id="resume-btn">Resume</button>
            </div>
        `;
        container.style.display = 'block';
        
        container.querySelector('.mission-card').addEventListener('click', () => handleResume(activeJourney));
    }
}

function handleResume(journey) {
    const isBoss = (journey.currentLevel % 50 === 0) || (journey.currentLevel === journey.totalLevels);
    stateService.setNavigationContext({
        topic: journey.goal,
        level: journey.currentLevel,
        journeyId: journey.id,
        isBoss: isBoss,
        totalLevels: journey.totalLevels
    });
    window.location.hash = '#/level';
}

function renderRecentHistory() {
    const history = historyService.getRecentHistory(4);
    const container = document.getElementById('recent-history-container');
    if (!container) return;
    
    if (history.length === 0) {
        container.innerHTML = `<div class="card" style="text-align:center; color:var(--color-text-secondary); padding: 1rem;">No recent activity. Start a mission!</div>`;
        return;
    }
    
    container.innerHTML = history.map(item => `
        <div class="card activity-card interactive" data-topic="${item.topic}">
            <div class="activity-main">
                <span class="activity-topic">${item.topic}</span>
                <span class="activity-score">${item.type === 'aural' ? 'Audio Session' : 'Score: ' + item.score + '/' + item.totalQuestions}</span>
            </div>
            <svg class="icon" style="color:var(--color-text-secondary);"><use href="assets/icons/feather-sprite.svg#chevron-down" style="transform:rotate(-90deg)"/></svg>
        </div>
    `).join('');

    container.querySelectorAll('.activity-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const topicFull = e.currentTarget.dataset.topic;
            // Clean topic string (remove " - Level X")
            const topic = topicFull.split(' - ')[0]; 
            initiateQuizGeneration(topic);
        });
    });
}

async function initiateQuizGeneration(topic) {
    if (!topic) return;
    const cmdBtn = document.getElementById('command-submit-btn');
    if (cmdBtn) {
        cmdBtn.innerHTML = `Running...`;
        cmdBtn.disabled = true;
    }

    try {
        const plan = await apiService.generateJourneyPlan(topic);
        const journey = await learningPathService.startOrGetJourney(topic, plan);

        stateService.setNavigationContext({
            topic: journey.goal,
            level: journey.currentLevel,
            journeyId: journey.id,
            isBoss: false,
            totalLevels: journey.totalLevels
        });
        window.location.hash = '#/level';
    } catch (error) {
        console.error(error);
        showToast("Error initializing protocol.", "error");
        if (cmdBtn) {
            cmdBtn.innerHTML = "Initialize";
            cmdBtn.disabled = false;
        }
    }
}

export function init() {
    elements = {
        greeting: document.getElementById('home-greeting'),
        levelDisplay: document.getElementById('home-level'),
        streakDisplay: document.getElementById('home-streak'),
        commandForm: document.getElementById('command-form'),
        commandInput: document.getElementById('command-input')
    };

    updateGreeting();
    updateHUD();
    renderResumeCard();
    renderRecentHistory();

    if (elements.commandForm) {
        elements.commandForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const topic = elements.commandInput.value.trim();
            if (topic) initiateQuizGeneration(topic);
        });
    }
}

export function destroy() {}
