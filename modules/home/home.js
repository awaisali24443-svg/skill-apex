
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';

let elements = {};

async function runDiagnostics() {
    const aiStatus = await apiService.checkSystemStatus();
    const aiIndicator = document.getElementById('ai-status-indicator');
    if (aiIndicator) {
        aiIndicator.style.setProperty('--status-color', aiStatus.status === 'online' ? 'var(--color-success)' : 'var(--color-error)');
    }
}

function setupEchoes() {
    const ticker = document.getElementById('echoes-ticker');
    firebaseService.listenToGlobalEchoes((echoes) => {
        if (!ticker) return;
        ticker.innerHTML = echoes.map(e => {
            let msg = '';
            if (e.type === 'LEVEL_UP') msg = `Agent <strong>${e.userName}</strong> reached Level ${e.topic}`;
            else if (e.type === 'JOURNEY_START') msg = `New protocol initialized for <strong>${e.topic}</strong>`;
            else msg = `<strong>${e.userName}</strong> synchronized on ${e.topic}`;
            return `<span class="echo-item">${msg}</span>`;
        }).join('');
    });
}

function renderResumeCard() {
    const journeys = learningPathService.getAllJourneys();
    if (!journeys || journeys.length === 0) return;
    const active = journeys[0];
    const progress = Math.round(((active.currentLevel - 1) / active.totalLevels) * 100);
    elements.resumeSection.innerHTML = `
        <div class="mission-content hud-corners">
            <div class="mission-info">
                <h4>Primary Objective</h4>
                <h2 class="glow-text">${active.goal}</h2>
                <div class="mission-meta"><span>PROGRESS: ${progress}%</span></div>
            </div>
            <button class="btn btn-primary" id="resume-btn">RESUME MISSION</button>
        </div>
    `;
    elements.resumeSection.style.display = 'block';
    document.getElementById('resume-btn').onclick = () => {
        stateService.setNavigationContext({ topic: active.goal, level: active.currentLevel, journeyId: active.id });
        window.location.href = '/level';
    };
}

export function init() {
    elements = {
        greeting: document.getElementById('home-greeting'),
        levelDisplay: document.getElementById('home-level'),
        streakDisplay: document.getElementById('home-streak'),
        resumeSection: document.getElementById('resume-section'),
        commandForm: document.getElementById('command-form'),
        commandInput: document.getElementById('command-input')
    };

    const name = firebaseService.getUserName();
    elements.greeting.textContent = `Welcome, ${name}`;
    
    const stats = gamificationService.getStats();
    if(elements.levelDisplay) elements.levelDisplay.textContent = stats.level;
    if(elements.streakDisplay) elements.streakDisplay.textContent = stats.currentStreak;

    renderResumeCard();
    runDiagnostics();
    setupEchoes();
}
