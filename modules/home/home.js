


import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import * as levelCacheService from '../../services/levelCacheService.js';
import { showToast } from '../../services/toastService.js';

let historyClickHandler;
let challengeBtn;

function checkOnboarding() {
    // Check if user has already selected an interest
    const existingInterest = learningPathService.getUserInterest();
    const overlay = document.getElementById('onboarding-overlay');
    
    // If user has already chosen, DO NOT show popup.
    // Remove it from DOM entirely to prevent any visual glitches
    if (existingInterest) {
        if (overlay) {
            overlay.style.display = 'none'; // Instant hide
            overlay.classList.remove('visible');
            overlay.remove(); // Remove from DOM
        }
        return;
    }
    
    if (overlay) {
        overlay.style.display = 'flex';
        // Force reflow
        void overlay.offsetWidth;
        // Add visible class for transition
        overlay.classList.add('visible');
        
        // Add listeners to buttons
        overlay.querySelectorAll('.interest-card').forEach(card => {
            // Remove old listeners to prevent duplicates if re-initialized
            const newCard = card.cloneNode(true);
            card.parentNode.replaceChild(newCard, card);
            
            newCard.addEventListener('click', () => {
                const category = newCard.dataset.category;
                
                // SAVE THE CHOICE PERMANENTLY FIRST
                learningPathService.saveUserInterest(category);

                // Fade out
                overlay.classList.remove('visible');
                setTimeout(() => {
                    overlay.style.display = 'none';
                    overlay.remove(); // Remove from DOM after fade
                }, 400); 

                if (category === 'custom') {
                    // For custom, we just go to the standard list
                    window.location.hash = '#/topics';
                } else {
                    // For preset, we also go to topics, but the list module will filter/preload
                    window.location.hash = '#/topics';
                }
            });
        });
    }
}

function renderStreak() {
    const stats = gamificationService.getStats();
    const streakCounter = document.getElementById('streak-counter');
    if (stats.currentStreak > 0) {
        streakCounter.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="assets/icons/feather-sprite.svg#zap"/></svg>
            <span><strong>${stats.currentStreak} Day</strong> Streak</span>
        `;
        streakCounter.style.display = 'inline-flex';
    } else {
        streakCounter.style.display = 'none';
    }
}

function renderPrimaryAction() {
    const journeys = learningPathService.getAllJourneys();
    const path = journeys.length > 0 ? journeys[0] : null;

    const card = document.getElementById('primary-action-card');
    const icon = document.getElementById('primary-action-icon');
    const title = document.getElementById('primary-action-title');
    const description = document.getElementById('primary-action-description');

    if (path && path.currentLevel <= path.totalLevels) {
        card.href = `/#/game/${encodeURIComponent(path.goal)}`;
        icon.innerHTML = `<svg><use href="assets/icons/feather-sprite.svg#play"/></svg>`;
        title.textContent = 'Resume Journey';
        description.textContent = `Jump back into "${path.goal}" at Level ${path.currentLevel}`;
    } else {
        // Logic: If they have a saved interest, 'Start New' goes to topics list which is pre-filtered
        card.href = '/#/topics';
        icon.innerHTML = `<svg><use href="assets/icons/feather-sprite.svg#plus"/></svg>`;
        title.textContent = 'Start New Adventure';
        description.textContent = 'Generate a custom learning path on any topic you can imagine.';
    }
}

function renderRecentHistory() {
    const history = historyService.getRecentHistory(3);
    const container = document.getElementById('recent-history-container');
    if (history.length === 0 || !container) {
        if(container) container.style.display = 'none';
        return;
    }
    
    const cleanTopic = (topic) => topic.replace(/ - Level \d+$/, '').trim();

    container.innerHTML = '<h3>Recent Missions</h3>' + history.map(item => `
        <div class="card dashboard-card-small">
            <div class="history-mini-info">
                <p class="history-mini-title">${cleanTopic(item.topic)}</p>
                <span class="history-mini-score">${item.score !== undefined ? item.score + '/' + item.totalQuestions : 'Audio'}</span>
            </div>
            <button class="btn-small retry-btn" data-topic="${cleanTopic(item.topic)}">
                <svg class="icon"><use href="assets/icons/feather-sprite.svg#rotate-ccw"/></svg>
            </button>
        </div>
    `).join('');
    container.style.display = 'block';

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

// --- NEW: Neural Integrity (Memory Health) ---
function renderMemoryHealth() {
    const history = historyService.getHistory();
    if (history.length === 0) return; // No history, no decay

    const { health, status, oldestTopic } = gamificationService.calculateMemoryHealth(history);
    
    const widget = document.getElementById('memory-health-widget');
    const percentEl = document.getElementById('health-percentage');
    const barFill = document.getElementById('health-bar-fill');
    const statusText = document.getElementById('health-status-text');
    const repairBtn = document.getElementById('repair-memory-btn');
    
    widget.style.display = 'block';
    percentEl.textContent = `${health}%`;
    barFill.style.width = `${health}%`;
    
    // Status Colors
    if (status === 'Critical') {
        barFill.style.backgroundColor = 'var(--color-error)';
        widget.style.borderLeftColor = 'var(--color-error)';
        statusText.textContent = `Critical Decay: ${oldestTopic}`;
    } else if (status === 'Decaying') {
        barFill.style.backgroundColor = 'var(--color-primary)'; // Or orange if defined
        widget.style.borderLeftColor = 'var(--color-primary)';
        statusText.textContent = `Fading: ${oldestTopic}`;
    } else {
        barFill.style.backgroundColor = 'var(--color-success)';
        widget.style.borderLeftColor = 'var(--color-success)';
        statusText.textContent = "Neural pathways stable.";
    }
    
    // Show Repair button if health is low
    if (health < 90 && oldestTopic) {
        repairBtn.style.display = 'flex';
        repairBtn.onclick = () => {
            stateService.setNavigationContext({ topic: oldestTopic, level: 1, journeyId: 'repair', isBoss: false, totalLevels: 10 });
            window.location.hash = `#/game/${encodeURIComponent(oldestTopic)}`;
        };
    } else {
        repairBtn.style.display = 'none';
    }
}


// --- Daily Challenge Logic ---
async function initDailyChallenge() {
    const container = document.getElementById('daily-challenge-card');
    const statusText = document.getElementById('daily-challenge-status');
    challengeBtn = document.getElementById('start-daily-challenge-btn');
    
    if (gamificationService.isDailyChallengeCompleted()) {
        container.classList.add('completed');
        statusText.textContent = "Challenge Completed! Come back tomorrow.";
        challengeBtn.disabled = true;
        challengeBtn.textContent = "Done";
        container.style.display = 'block';
        return;
    }

    container.style.display = 'block';
    
    challengeBtn.onclick = async () => {
        challengeBtn.disabled = true;
        challengeBtn.textContent = "Loading...";
        
        try {
            const challenge = await apiService.fetchDailyChallenge();
            
            const optionsHtml = challenge.options.map((opt, i) => 
                `<button class="btn option-btn" data-idx="${i}" style="width:100%; margin-bottom:8px; text-align:left;">${opt}</button>`
            ).join('');
            
            const modalHtml = `
                <div class="challenge-modal">
                    <h3 style="color:var(--color-primary); margin-bottom:1rem;">${challenge.topic} Trivia</h3>
                    <p style="font-size:1.2rem; margin-bottom:1.5rem;">${challenge.question}</p>
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
                    container.classList.add('completed');
                    statusText.textContent = "Challenge Completed!";
                    challengeBtn.textContent = "Done";
                } else {
                    showToast(`Wrong! It was: ${challenge.options[challenge.correctAnswerIndex]}`, "error");
                }
                
                modalContainer.style.display = 'none';
                challengeBtn.disabled = gamificationService.isDailyChallengeCompleted();
                if(!gamificationService.isDailyChallengeCompleted()) challengeBtn.textContent = "Play";
            });
            
            document.getElementById('cancel-challenge').onclick = () => {
                modalContainer.style.display = 'none';
                challengeBtn.disabled = false;
                challengeBtn.textContent = "Play";
            };

        } catch (e) {
            showToast("Failed to load challenge.", "error");
            challengeBtn.disabled = false;
            challengeBtn.textContent = "Play";
        }
    };
}

// --- Preloading ---
async function preloadCriticalModules() {
    const moduleName = 'topic-list';
    try {
        await Promise.all([
            fetch(`./modules/${moduleName}/${moduleName}.html`).then(res => res.text()),
            fetch(`./modules/${moduleName}/${moduleName}.css`).then(res => res.text()),
            import(`../../modules/${moduleName}/${moduleName}.js`)
        ]);
        console.log('Preloaded topic-list module.');
    } catch (e) {
        // Ignore
    }
}

export function init() {
    renderStreak();
    renderPrimaryAction();
    renderRecentHistory();
    renderMemoryHealth();
    initDailyChallenge();
    checkOnboarding();
    
    setTimeout(preloadCriticalModules, 1000);
}

export function destroy() {
    const container = document.getElementById('recent-history-container');
    if (container && historyClickHandler) {
        container.removeEventListener('click', historyClickHandler);
    }
}
