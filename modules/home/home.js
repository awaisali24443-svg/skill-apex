

import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import * as levelCacheService from '../../services/levelCacheService.js';
import { showToast } from '../../services/toastService.js';

let historyClickHandler;
let challengeBtn;

// --- HARDCODED INTEREST DATA (THE FAKE AI + PREDICTIVE METADATA) ---
// We add 'totalLevels' to skip the first API call (Journey Plan).
// We do NOT pre-generate questions to keep the app lightweight.
const INTEREST_DATA = {
    cs: [
        { name: "Python for Beginners", description: "Master the basics of Python, the world's most popular language.", styleClass: "topic-programming", totalLevels: 50 },
        { name: "Ethical Hacking", description: "Learn penetration testing and network defense strategies.", styleClass: "topic-space", totalLevels: 60 },
        { name: "Web Development 101", description: "HTML, CSS, and JavaScript: Build your first website.", styleClass: "topic-arts", totalLevels: 40 },
        { name: "Artificial Intelligence", description: "Understand Neural Networks, ML, and the future of tech.", styleClass: "topic-robotics", totalLevels: 100 }
    ],
    history: [
        { name: "World War II", description: "The global conflict that shaped the modern world.", styleClass: "topic-finance", totalLevels: 80 },
        { name: "Ancient Rome", description: "Rise and fall of the greatest empire in history.", styleClass: "topic-philosophy", totalLevels: 70 },
        { name: "History of Pakistan", description: "From the Indus Valley to independence and beyond.", styleClass: "topic-biology", totalLevels: 50 },
        { name: "The Industrial Revolution", description: "How machines changed human society forever.", styleClass: "topic-programming", totalLevels: 40 }
    ],
    science: [
        { name: "Quantum Physics", description: "Dive into the bizarre world of subatomic particles.", styleClass: "topic-space", totalLevels: 120 },
        { name: "Human Biology", description: "Anatomy, physiology, and the miracle of life.", styleClass: "topic-medicine", totalLevels: 90 },
        { name: "Space Exploration", description: "Rockets, Mars missions, and the search for aliens.", styleClass: "topic-programming", totalLevels: 60 },
        { name: "Organic Chemistry", description: "The carbon-based building blocks of existence.", styleClass: "topic-ecology", totalLevels: 80 }
    ],
    business: [
        { name: "Digital Marketing", description: "SEO, Social Media, and growth hacking strategies.", styleClass: "topic-arts", totalLevels: 50 },
        { name: "Financial Literacy", description: "Investing, saving, and managing personal wealth.", styleClass: "topic-finance", totalLevels: 30 },
        { name: "Entrepreneurship", description: "How to start, fund, and scale your own startup.", styleClass: "topic-robotics", totalLevels: 60 },
        { name: "Stock Market Basics", description: "Understanding bulls, bears, and trading.", styleClass: "topic-programming", totalLevels: 40 }
    ]
};

function checkOnboarding() {
    const hasSeenOnboarding = localStorage.getItem('kt_onboarding_complete');
    const overlay = document.getElementById('onboarding-overlay');
    
    if (!hasSeenOnboarding && overlay) {
        overlay.style.display = 'flex';
        
        // Add listeners to buttons
        overlay.querySelectorAll('.interest-card').forEach(card => {
            card.addEventListener('click', () => {
                const category = card.dataset.category;
                
                localStorage.setItem('kt_onboarding_complete', 'true');
                
                // Fade out
                overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).onfinish = () => {
                    overlay.style.display = 'none';
                };

                if (category === 'custom') {
                    // Just go to topics page normally
                    window.location.hash = '#/topics';
                } else {
                    // Inject "Fake AI" data (Metadata Only - Lightweight)
                    const fakeTopics = INTEREST_DATA[category];
                    stateService.setNavigationContext({ preloadedTopics: fakeTopics });
                    
                    // We intentionally DO NOT start background generation here.
                    // It risks slowing down the UI during the demo. 
                    // The "Instant Map" (Level 1-50) from the metadata is impressive enough.

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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="/assets/icons/feather-sprite.svg#zap"/></svg>
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
        icon.innerHTML = `<svg><use href="/assets/icons/feather-sprite.svg#play"/></svg>`;
        title.textContent = 'Resume Journey';
        description.textContent = `Jump back into "${path.goal}" at Level ${path.currentLevel}`;
    } else {
        card.href = '/#/topics';
        icon.innerHTML = `<svg><use href="/assets/icons/feather-sprite.svg#plus"/></svg>`;
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
                <svg class="icon"><use href="/assets/icons/feather-sprite.svg#rotate-ccw"/></svg>
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
    // Silently fetch the topic-list module so clicking "Start" feels instant
    const moduleName = 'topic-list';
    try {
        await Promise.all([
            fetch(`./modules/${moduleName}/${moduleName}.html`).then(res => res.text()),
            fetch(`./modules/${moduleName}/${moduleName}.css`).then(res => res.text()),
            import(`../../modules/${moduleName}/${moduleName}.js`)
        ]);
        console.log('Preloaded topic-list module.');
    } catch (e) {
        // Ignore errors in background preload
    }
}

export function init() {
    renderStreak();
    renderPrimaryAction();
    renderRecentHistory();
    renderMemoryHealth();
    initDailyChallenge();
    checkOnboarding();
    
    // Trigger preload after a short delay to let main thread settle
    setTimeout(preloadCriticalModules, 1000);
}

export function destroy() {
    const container = document.getElementById('recent-history-container');
    if (container && historyClickHandler) {
        container.removeEventListener('click', historyClickHandler);
    }
}
