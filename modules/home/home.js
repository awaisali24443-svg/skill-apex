

import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import { showToast } from '../../services/toastService.js';
import { LOCAL_STORAGE_KEYS } from '../../constants.js';

// --- 1. Welcome Logic ---
function checkWelcome() {
    const hasSeenWelcome = localStorage.getItem(LOCAL_STORAGE_KEYS.WELCOME_COMPLETED);
    if (!hasSeenWelcome) {
        const modal = document.getElementById('welcome-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('close-welcome-btn').onclick = () => {
                modal.style.display = 'none';
                localStorage.setItem(LOCAL_STORAGE_KEYS.WELCOME_COMPLETED, 'true');
                checkOnboarding(); // Chain next step
            };
        }
    } else {
        checkOnboarding();
    }
}

function checkOnboarding() {
    const existingInterest = learningPathService.getUserInterest();
    const overlay = document.getElementById('onboarding-overlay');
    
    if (existingInterest) {
        if (overlay) overlay.remove();
        return;
    }
    
    if (overlay) {
        overlay.style.display = 'flex';
        void overlay.offsetWidth;
        overlay.classList.add('visible');
        
        overlay.querySelectorAll('.interest-card').forEach(card => {
            card.onclick = () => {
                const category = card.dataset.category;
                learningPathService.saveUserInterest(category);
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 400); 
                
                // Navigate to topics to start exploring immediately
                window.location.hash = '#/topics';
            };
        });
    }
}

// --- 2. Dashboard Renders ---

function renderHeaderStats() {
    const stats = gamificationService.getStats();
    
    const streakEl = document.getElementById('streak-counter');
    if (stats.currentStreak > 0) {
        streakEl.style.display = 'flex';
        document.getElementById('streak-value').textContent = `${stats.currentStreak} Days`;
    }
    
    document.getElementById('header-level').textContent = `${stats.level}`;
}

function renderHeroAction() {
    const container = document.getElementById('hero-section');
    const journeys = learningPathService.getAllJourneys();
    const activeJourney = journeys.length > 0 ? journeys[0] : null;
    const isDailyDone = gamificationService.isDailyChallengeCompleted();

    let html = '';

    // Logic: If active journey exists and isn't finished -> RESUME
    // Else -> START NEW
    if (activeJourney && activeJourney.currentLevel <= activeJourney.totalLevels) {
        const progress = Math.round(((activeJourney.currentLevel - 1) / activeJourney.totalLevels) * 100);
        
        html = `
            <div class="card hero-card resume">
                <div class="hero-icon-lg">
                    <svg class="icon"><use href="/assets/icons/feather-sprite.svg#play"/></svg>
                </div>
                <div class="hero-content">
                    <span class="hero-tag">Active Mission</span>
                    <h2 class="hero-title">${activeJourney.goal}</h2>
                    <p class="hero-detail">Level ${activeJourney.currentLevel} • ${progress}% Complete</p>
                </div>
                <div class="hero-action">
                    <a href="#/game/${encodeURIComponent(activeJourney.goal)}" class="btn btn-primary btn-lg">
                        Resume Journey <svg class="icon"><use href="/assets/icons/feather-sprite.svg#arrow-right"/></svg>
                    </a>
                </div>
            </div>
        `;
    } else {
        html = `
            <div class="card hero-card start">
                <div class="hero-icon-lg">
                    <svg class="icon"><use href="/assets/icons/feather-sprite.svg#compass"/></svg>
                </div>
                <div class="hero-content">
                    <span class="hero-tag">Ready to Learn</span>
                    <h2 class="hero-title">Start a New Journey</h2>
                    <p class="hero-detail">Pick a topic and let the AI build your curriculum.</p>
                </div>
                <div class="hero-action">
                    <a href="#/topics" class="btn btn-primary btn-lg">
                        Explore Topics <svg class="icon"><use href="/assets/icons/feather-sprite.svg#arrow-right"/></svg>
                    </a>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function renderRecentActivity() {
    const list = document.getElementById('recent-activity-list');
    const history = historyService.getRecentHistory(3);

    if (history.length === 0) {
        return; // Keeps default empty message
    }

    list.innerHTML = history.map(item => {
        const isPass = (item.score / item.totalQuestions) >= 0.6;
        const icon = isPass ? 'check-circle' : 'x-circle';
        const cls = isPass ? 'passed' : 'failed';
        const cleanTopic = item.topic.replace(/ - Level \d+$/, '');
        const levelMatch = item.topic.match(/Level (\d+)/);
        const level = levelMatch ? `Level ${levelMatch[1]}` : 'Quiz';

        return `
            <div class="activity-item">
                <div class="activity-status-icon ${cls}">
                    <svg class="icon"><use href="/assets/icons/feather-sprite.svg#${icon}"/></svg>
                </div>
                <div class="activity-details">
                    <h4>${cleanTopic}</h4>
                    <p>${level}</p>
                </div>
                <span class="activity-score">${Math.round((item.score / item.totalQuestions) * 100)}%</span>
            </div>
        `;
    }).join('');
}

function initDailyChallenge() {
    const btn = document.getElementById('daily-challenge-btn');
    const card = document.getElementById('daily-challenge-card');
    
    if (gamificationService.isDailyChallengeCompleted()) {
        btn.textContent = "Completed";
        btn.disabled = true;
        card.style.opacity = 0.7;
        return;
    }

    btn.onclick = async () => {
        btn.textContent = "Loading...";
        try {
            const challenge = await apiService.fetchDailyChallenge();
            showDailyChallengeModal(challenge);
        } catch (e) {
            showToast("Failed to load challenge.", "error");
        } finally {
            btn.textContent = "Start Challenge";
        }
    };
}

function showDailyChallengeModal(challenge) {
    const modalContainer = document.getElementById('modal-container');
    const optionsHtml = challenge.options.map((opt, i) => 
        `<button class="btn option-btn" data-idx="${i}" style="width:100%; margin-bottom:8px; text-align:left; padding: 1rem;">${opt}</button>`
    ).join('');
    
    modalContainer.innerHTML = `
        <div class="modal-backdrop">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${challenge.topic} Trivia</h2>
                </div>
                <p style="font-size:1.2rem; margin-bottom:1.5rem; line-height:1.4;">${challenge.question}</p>
                <div id="challenge-options">${optionsHtml}</div>
                <div class="modal-footer" style="margin-top:1rem; text-align:center;">
                    <button id="cancel-challenge" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        </div>
    `;
    modalContainer.style.display = 'flex';
    
    const backdrop = modalContainer.querySelector('.modal-backdrop');
    const cancelBtn = document.getElementById('cancel-challenge');
    
    const close = () => modalContainer.innerHTML = '';
    
    cancelBtn.onclick = close;
    backdrop.onclick = (e) => { if(e.target === backdrop) close(); };

    document.getElementById('challenge-options').onclick = (e) => {
        const optBtn = e.target.closest('.option-btn');
        if (!optBtn) return;
        
        const isCorrect = parseInt(optBtn.dataset.idx) === challenge.correctAnswerIndex;
        if (isCorrect) {
            showToast("Correct! +200 XP", "success");
            gamificationService.completeDailyChallenge();
            initDailyChallenge(); // Refresh button state
        } else {
            showToast(`Wrong! Answer: ${challenge.options[challenge.correctAnswerIndex]}`, "error");
        }
        close();
    };
}

function renderNeuralHealth() {
    const history = historyService.getHistory();
    const { health, status, oldestTopic } = gamificationService.calculateMemoryHealth(history);
    
    document.getElementById('health-percentage').textContent = `${health}%`;
    document.getElementById('health-bar-fill').style.width = `${health}%`;
    document.getElementById('health-status-text').textContent = status === 'Stable' ? 'Systems Nominal' : `${status}: ${oldestTopic}`;
    
    const btn = document.getElementById('repair-memory-btn');
    if (health < 100 && oldestTopic) {
        btn.style.display = 'block';
        btn.onclick = () => {
            stateService.setNavigationContext({ topic: oldestTopic, level: 1, journeyId: 'repair', isBoss: false, totalLevels: 10 });
            window.location.hash = `#/game/${encodeURIComponent(oldestTopic)}`;
        };
    } else {
        btn.style.display = 'none';
    }
}

export function init() {
    renderHeaderStats();
    renderHeroAction();
    renderRecentActivity();
    renderNeuralHealth();
    initDailyChallenge();
    checkWelcome(); // Triggers welcome or onboarding
}

export function destroy() {}
