
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';

function setGreeting() {
    const hour = new Date().getHours();
    let greeting = "Welcome";
    if (hour < 12) greeting = "Good Morning";
    else if (hour < 18) greeting = "Good Afternoon";
    else greeting = "Good Evening";

    const name = firebaseService.getUserName() || "Agent";
    
    const titleEl = document.getElementById('greeting-main');
    if (titleEl) {
        const text = `${greeting}, ${name}.`;
        titleEl.textContent = text;
        // IMPORTANT: Update data-text for the CSS Glitch effect to match
        titleEl.setAttribute('data-text', text);
    }
    
    // Update Stats Pill
    const stats = gamificationService.getStats();
    document.getElementById('home-streak-display').textContent = stats.currentStreak;
    document.getElementById('home-xp-display').textContent = stats.xp;
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
    
    cardContainer.innerHTML = `
        <div class="continue-info">
            <h4>${lastJourney.goal}</h4>
            <p>Level ${lastJourney.currentLevel} • Ready to resume</p>
        </div>
        <div class="continue-btn">
            <svg class="icon"><use href="assets/icons/feather-sprite.svg#play"/></svg>
        </div>
    `;
    
    cardContainer.onclick = () => {
        initiateQuizGeneration(lastJourney.goal);
    };
}

async function initiateQuizGeneration(topic) {
    if (!topic) return;

    // Show visual feedback (simple toast for now, could be loader)
    showToast(`Initializing: ${topic}`, 'info');

    try {
        // 1. Get Offline Plan
        const plan = await apiService.generateJourneyPlan(topic);
        
        // 2. Register journey in local tracking
        const journey = await learningPathService.startOrGetJourney(topic, plan);

        // 3. Set Context
        stateService.setNavigationContext({
            topic: journey.goal,
            level: journey.currentLevel,
            journeyId: journey.id,
            isBoss: false,
            totalLevels: journey.totalLevels
        });
        
        // 4. Navigate to Level
        window.location.hash = '#/level';

    } catch (error) {
        console.error(error);
        showToast("Error starting quiz.", "error");
    }
}

export function init() {
    setGreeting();
    renderContinueCard();
    
    const form = document.getElementById('quick-quiz-form');
    const input = document.getElementById('quick-quiz-input');
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const topic = input.value.trim();
            if (topic) {
                initiateQuizGeneration(topic);
            } else {
                showToast("Please enter a topic", "info");
            }
        });
    }
    
    // Preset buttons
    document.querySelectorAll('.expo-card').forEach(btn => {
        btn.addEventListener('click', () => {
            initiateQuizGeneration(btn.dataset.topic);
        });
    });
}

export function destroy() {}
