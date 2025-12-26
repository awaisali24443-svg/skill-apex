
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import * as vfxService from '../../services/vfxService.js';

let elements = {};

function updateGreeting() {
    const hour = new Date().getHours();
    let timeGreeting = "Good Morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good Afternoon";
    else if (hour >= 17) timeGreeting = "Good Evening";

    let userName = firebaseService.getUserName() || 'Agent';
    
    if (elements.greeting) {
        elements.greeting.textContent = `${timeGreeting}, ${userName}`;
    }
}

function updateHUD() {
    const stats = gamificationService.getStats();
    if(elements.levelDisplay) elements.levelDisplay.textContent = stats.level;
    if(elements.streakDisplay) elements.streakDisplay.textContent = stats.currentStreak;

    if (elements.streakBarFill && elements.streakFraction) {
        const streak = stats.currentStreak || 0;
        const target = 21;
        const percent = Math.min(100, (streak / target) * 100);
        
        elements.streakBarFill.style.width = `${percent}%`;
        elements.streakFraction.textContent = `${streak}/${target}`;
        
        if (streak >= 21) {
            elements.streakBarFill.style.background = 'var(--color-success)';
            elements.streakMessage.textContent = "Challenge Complete! Habit Formed.";
        } else {
            elements.streakMessage.textContent = "Build the habit. 21 days to go.";
        }
    }
}

function renderResumeCard() {
    const journeys = learningPathService.getAllJourneys();
    
    if (!journeys || journeys.length === 0) {
        if (elements.resumeSection) elements.resumeSection.style.display = 'none';
        return;
    }

    const activeJourney = journeys[0]; 
    const progressPercent = Math.round(((activeJourney.currentLevel - 1) / activeJourney.totalLevels) * 100);

    if (elements.resumeSection) {
        elements.resumeSection.innerHTML = `
            <div class="mission-content">
                <div class="mission-info">
                    <h4>Current Objective</h4>
                    <h2>${activeJourney.goal}</h2>
                    <div class="mission-meta">
                        <span>Lvl ${activeJourney.currentLevel}</span>
                        <div class="mission-progress-track">
                            <div class="mission-progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <span>${progressPercent}%</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-resume" id="resume-btn" data-id="${activeJourney.id}">
                    RESUME
                </button>
            </div>
            <div style="position:absolute; right:-20px; bottom:-20px; opacity:0.05; transform:rotate(-15deg);">
                <svg class="icon" style="width:150px; height:150px;"><use href="assets/icons/feather-sprite.svg#target"/></svg>
            </div>
        `;
        elements.resumeSection.style.display = 'block';
        
        document.getElementById('resume-btn').addEventListener('click', () => {
            handleResume(activeJourney);
        });
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
        container.innerHTML = `<div style="color:var(--color-text-secondary); font-size:0.85rem; padding:10px; font-style:italic;">No recent activity logged.</div>`;
        return;
    }
    
    container.innerHTML = history.map(item => `
        <div class="history-mini-item clickable-history" data-topic="${item.topic}">
            <span class="h-topic">${item.topic}</span>
            <span class="h-meta">
                ${item.type === 'aural' ? 'Audio' : item.score + '/' + item.totalQuestions}
            </span>
        </div>
    `).join('');

    container.querySelectorAll('.clickable-history').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const topicFull = e.currentTarget.dataset.topic;
            const topic = topicFull.split(' - ')[0]; 
            initiateQuizGeneration(topic);
        });
    });
}

async function initiateQuizGeneration(topic) {
    if (!topic) return;
    const cmdBtn = document.getElementById('command-submit-btn');
    if (cmdBtn) {
        cmdBtn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border:2px solid white;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>`;
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
        showToast("Error initializing protocol.", "error");
        if (cmdBtn) {
            cmdBtn.innerHTML = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#arrow-right"/></svg>`;
            cmdBtn.disabled = false;
        }
    }
}

export function init() {
    elements = {
        greeting: document.getElementById('home-greeting'),
        levelDisplay: document.getElementById('home-level'),
        streakDisplay: document.getElementById('home-streak'),
        streakBarFill: document.getElementById('streak-bar-fill'),
        streakFraction: document.getElementById('streak-fraction'),
        streakMessage: document.getElementById('streak-message'),
        resumeSection: document.getElementById('resume-section'),
        commandForm: document.getElementById('command-form'),
        commandInput: document.getElementById('command-input'),
        cameraBtn: document.getElementById('home-camera-btn'),
        fileInput: document.getElementById('home-file-input'),
        // Briefing
        briefingBtn: document.getElementById('trigger-briefing-btn'),
        briefingModal: document.getElementById('briefing-modal'),
        closeBriefingBtn: document.getElementById('close-briefing-btn')
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

    if (elements.briefingBtn) {
        elements.briefingBtn.addEventListener('click', () => {
            elements.briefingModal.style.display = 'flex';
        });
    }

    if (elements.closeBriefingBtn) {
        elements.closeBriefingBtn.addEventListener('click', () => {
            elements.briefingModal.style.display = 'none';
        });
    }

    if (elements.cameraBtn) elements.cameraBtn.addEventListener('click', () => elements.fileInput.click());
    
    document.querySelectorAll('.protocol-card').forEach(card => {
        card.addEventListener('click', () => initiateQuizGeneration(card.dataset.topic));
    });
}

export function destroy() {}
