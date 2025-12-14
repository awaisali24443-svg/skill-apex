
import * as gamificationService from '../../services/gamificationService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';

function renderStats() {
    const stats = gamificationService.getStats();
    const streakEl = document.getElementById('home-streak-display');
    const xpEl = document.getElementById('home-xp-display');
    
    if (streakEl) streakEl.textContent = stats.currentStreak;
    if (xpEl) xpEl.textContent = stats.xp.toLocaleString();
}

function renderContinueCard() {
    const journeys = learningPathService.getAllJourneys();
    const container = document.getElementById('continue-learning-section');
    const cardContainer = document.getElementById('continue-card');
    
    if (!journeys || journeys.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const lastJourney = journeys[0]; // Most recent
    
    // We call it "Quiz" instead of "Journey" for the user
    cardContainer.innerHTML = `
        <div class="continue-info">
            <h4>${lastJourney.goal}</h4>
            <p>Level ${lastJourney.currentLevel} • Ready</p>
        </div>
        <div class="continue-btn-icon">
            <svg class="icon"><use href="assets/icons/feather-sprite.svg#play"/></svg>
        </div>
    `;
    
    cardContainer.onclick = () => {
        initiateQuizGeneration(lastJourney.goal);
    };
}

async function initiateQuizGeneration(topic) {
    if (!topic) return;

    showToast(`Initializing Quiz: ${topic}`, 'info');

    try {
        // 1. Get Offline Plan (Quick Metadata)
        const plan = await apiService.generateJourneyPlan(topic);
        
        // 2. Register journey in local tracking (if not exists)
        const journey = await learningPathService.startOrGetJourney(topic, plan);

        // 3. Set Context for the Level
        stateService.setNavigationContext({
            topic: journey.goal,
            level: journey.currentLevel,
            journeyId: journey.id,
            isBoss: false,
            totalLevels: journey.totalLevels
        });
        
        // 4. Navigate directly to Level (Quiz)
        window.location.hash = '#/level';

    } catch (error) {
        console.error(error);
        showToast("Error initializing quiz system.", "error");
    }
}

export function init() {
    renderStats();
    renderContinueCard();
    
    const form = document.getElementById('quick-quiz-form');
    const input = document.getElementById('quick-quiz-input');
    
    // Handle Form Submit
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const topic = input.value.trim();
            if (topic) {
                // Hide keyboard on mobile
                input.blur();
                initiateQuizGeneration(topic);
            } else {
                showToast("Please enter a topic", "info");
                input.focus();
            }
        });
    }
    
    // Handle Suggestion Chips
    document.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => {
            initiateQuizGeneration(btn.dataset.topic);
        });
    });
}

export function destroy() {}
