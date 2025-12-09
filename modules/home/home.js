
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';

let historyClickHandler;
let challengeBtn;

function checkOnboarding() {
    const existingInterest = learningPathService.getUserInterest();
    const overlay = document.getElementById('onboarding-overlay');
    
    if (existingInterest) {
        if (overlay) overlay.remove();
        return;
    }
    
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.classList.add('visible');
        
        overlay.querySelectorAll('.interest-card').forEach(card => {
            const newCard = card.cloneNode(true);
            card.parentNode.replaceChild(newCard, card);
            
            newCard.addEventListener('click', () => {
                const category = newCard.dataset.category;
                learningPathService.saveUserInterest(category);
                overlay.classList.remove('visible');
                setTimeout(() => { overlay.remove(); }, 400); 
                window.location.hash = '#/topics';
            });
        });
    }
}

function renderStats() {
    const stats = gamificationService.getStats();
    const history = historyService.getHistory();
    const { health } = gamificationService.calculateMemoryHealth(history);

    // Update Top Row Stats
    document.getElementById('streak-value').textContent = stats.currentStreak;
    document.getElementById('xp-value').textContent = stats.xp.toLocaleString();
    
    const healthVal = document.getElementById('health-value');
    const healthCard = document.getElementById('health-stat-card');
    healthVal.textContent = `${health}%`;
    
    // Repair Widget Logic
    const repairWidget = document.getElementById('repair-memory-widget');
    if (health < 80) {
        // Change icon gradient to red warning style if health is low
        const iconWrapper = healthCard.querySelector('.stat-icon-wrapper');
        iconWrapper.className = 'stat-icon-wrapper gradient-red';
        
        if(repairWidget) {
            repairWidget.style.display = 'block';
            document.getElementById('repair-memory-btn').onclick = () => {
                const { oldestTopic } = gamificationService.calculateMemoryHealth(history);
                if(oldestTopic) {
                    stateService.setNavigationContext({ topic: oldestTopic, level: 1, journeyId: 'repair', isBoss: false, totalLevels: 10 });
                    window.location.hash = `#/game/${encodeURIComponent(oldestTopic)}`;
                }
            };
        }
    } else {
        if(repairWidget) repairWidget.style.display = 'none';
        // Reset to green
        const iconWrapper = healthCard.querySelector('.stat-icon-wrapper');
        iconWrapper.className = 'stat-icon-wrapper gradient-green';
    }
}

function renderPrimaryAction() {
    const journeys = learningPathService.getAllJourneys();
    const path = journeys.length > 0 ? journeys[0] : null;

    const card = document.getElementById('primary-action-card');
    const badge = document.getElementById('hero-badge');
    const title = document.getElementById('primary-action-title');
    const description = document.getElementById('primary-action-description');
    const cta = card.querySelector('.btn-text');
    const icon = document.getElementById('primary-action-icon');

    if (path && path.currentLevel <= path.totalLevels) {
        card.href = `#/game/${encodeURIComponent(path.goal)}`;
        badge.style.display = 'inline-block';
        badge.textContent = `RESUME: LEVEL ${path.currentLevel}`;
        title.textContent = path.goal;
        description.textContent = path.description || "Continue your path to mastery.";
        cta.textContent = "Resume Mission";
        icon.innerHTML = `<svg><use href="assets/icons/feather-sprite.svg#play"/></svg>`;
    } else {
        card.href = '#/topics';
        badge.style.display = 'none';
        title.textContent = 'Initiate New Operation';
        description.textContent = 'Select a topic and let AI generate a personalized curriculum.';
        cta.textContent = 'Explore Topics';
        icon.innerHTML = `<svg><use href="assets/icons/feather-sprite.svg#map"/></svg>`;
    }
}

function renderRecentHistory() {
    const history = historyService.getRecentHistory(4);
    const container = document.getElementById('recent-history-container');
    if (!container) return;
    
    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state-compact">
                <svg class="icon"><use href="assets/icons/feather-sprite.svg#archive"/></svg>
                <span>No recent missions found.</span>
            </div>`;
        return;
    }
    
    const cleanTopic = (topic) => topic.replace(/ - Level \d+$/, '').trim();

    container.innerHTML = history.map(item => `
        <div class="history-item-row">
            <div class="hist-info">
                <h4>${cleanTopic(item.topic)}</h4>
                <span class="hist-meta">${new Date(item.date).toLocaleDateString()} • ${item.score !== undefined ? item.score + '/' + item.totalQuestions : 'Audio Session'}</span>
            </div>
            <button class="btn-icon-tiny retry-btn" data-topic="${cleanTopic(item.topic)}" title="Replay">
                <svg class="icon"><use href="assets/icons/feather-sprite.svg#rotate-ccw"/></svg>
            </button>
        </div>
    `).join('');

    historyClickHandler = (e) => {
        const btn = e.target.closest('.retry-btn');
        if(btn) {
            const topic = btn.dataset.topic;
            stateService.setNavigationContext({ topic });
            window.location.hash = `#/game/${encodeURIComponent(topic)}`;
        }
    };
    container.addEventListener('click', historyClickHandler);
}

async function initDailyChallenge() {
    const card = document.getElementById('daily-challenge-card');
    const statusText = document.getElementById('daily-challenge-status');
    challengeBtn = document.getElementById('start-daily-challenge-btn');
    
    if (gamificationService.isDailyChallengeCompleted()) {
        card.classList.add('completed');
        statusText.textContent = "Protocol complete. System optimized.";
        challengeBtn.disabled = true;
        challengeBtn.innerHTML = `<span>Completed</span> <svg class="icon"><use href="assets/icons/feather-sprite.svg#check-circle"/></svg>`;
        return;
    }
    
    challengeBtn.onclick = async () => {
        challengeBtn.disabled = true;
        challengeBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;"></div> Loading...';
        
        try {
            const challenge = await apiService.fetchDailyChallenge();
            
            const optionsHtml = challenge.options.map((opt, i) => 
                `<button class="btn option-btn" data-idx="${i}" style="width:100%; margin-bottom:8px; text-align:left;">${opt}</button>`
            ).join('');
            
            const modalHtml = `
                <div class="challenge-modal">
                    <h3 style="color:var(--color-primary); margin-bottom:1rem;">${challenge.topic}</h3>
                    <p style="font-size:1.1rem; margin-bottom:1.5rem;">${challenge.question}</p>
                    <div id="challenge-options">${optionsHtml}</div>
                </div>
            `;
            
            const modalContainer = document.getElementById('modal-container');
            modalContainer.innerHTML = `
                <div class="modal-backdrop"></div>
                <div class="modal-content">
                    ${modalHtml}
                    <div class="modal-footer" style="justify-content:center; margin-top:1rem;">
                        <button id="cancel-challenge" class="btn">Close</button>
                    </div>
                </div>
            `;
            modalContainer.style.display = 'block';
            
            const optionsDiv = document.getElementById('challenge-options');
            optionsDiv.addEventListener('click', (e) => {
                const btn = e.target.closest('.option-btn');
                if(!btn) return;
                
                const selected = parseInt(btn.dataset.idx);
                const isCorrect = selected === challenge.correctAnswerIndex;
                
                if (isCorrect) {
                    showToast("Correct! +200 XP", "success");
                    gamificationService.completeDailyChallenge();
                    card.classList.add('completed');
                    statusText.textContent = "Protocol complete.";
                    challengeBtn.innerHTML = `<span>Completed</span> <svg class="icon"><use href="assets/icons/feather-sprite.svg#check-circle"/></svg>`;
                } else {
                    showToast(`Wrong! Answer: ${challenge.options[challenge.correctAnswerIndex]}`, "error");
                    challengeBtn.textContent = "Retry Tomorrow";
                }
                
                modalContainer.style.display = 'none';
                challengeBtn.disabled = gamificationService.isDailyChallengeCompleted();
            });
            
            document.getElementById('cancel-challenge').onclick = () => {
                modalContainer.style.display = 'none';
                challengeBtn.disabled = false;
                challengeBtn.textContent = "Execute (+200 XP)";
            };

        } catch (e) {
            showToast("Failed to load challenge.", "error");
            challengeBtn.disabled = false;
            challengeBtn.textContent = "Execute (+200 XP)";
        }
    };
}

export function init() {
    renderStats();
    renderPrimaryAction();
    renderRecentHistory();
    initDailyChallenge();
    checkOnboarding();
}

export function destroy() {
    const container = document.getElementById('recent-history-container');
    if (container && historyClickHandler) {
        container.removeEventListener('click', historyClickHandler);
    }
}
