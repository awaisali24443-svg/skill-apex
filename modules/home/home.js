
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import { showToast } from '../../services/toastService.js';

let historyClickHandler;

function renderRecentHistory() {
    const history = historyService.getRecentHistory(3);
    const container = document.getElementById('recent-history-container');
    if (!container) return;
    
    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state-compact">
                <span>No quizzes taken yet.</span>
            </div>`;
        return;
    }
    
    container.innerHTML = history.map(item => `
        <div class="history-item-row" style="display: flex; justify-content: space-between; padding: 1rem; background: var(--color-surface); margin-bottom: 0.5rem; border-radius: 8px; border: 1px solid var(--color-border);">
            <div class="hist-info">
                <h4 style="margin:0;">${item.topic}</h4>
                <span class="hist-meta" style="font-size:0.8rem; color:var(--color-text-secondary);">${item.score}/${item.totalQuestions} Correct</span>
            </div>
            <button class="btn-icon-tiny retry-btn" data-topic="${item.topic}" style="background:transparent; border:none; color:var(--color-primary); cursor:pointer;">
                Retry
            </button>
        </div>
    `).join('');

    historyClickHandler = (e) => {
        if (e.target.closest('.retry-btn')) {
            const topic = e.target.closest('.retry-btn').dataset.topic;
            // Clean topic string (remove " - Level X")
            const cleanTopic = topic.split(' - ')[0];
            initiateQuizGeneration(cleanTopic);
        }
    };
    container.addEventListener('click', historyClickHandler);
}

async function initiateQuizGeneration(topic) {
    if (!topic) return;

    const btn = document.getElementById('start-quiz-btn');
    const originalText = btn ? btn.innerHTML : '';
    
    // UI Loading State
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div> Generating...`;
    }

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
        
        // 4. Navigate to Level (which will generate specific questions from Mock DB)
        window.location.hash = '#/level';

    } catch (error) {
        console.error(error);
        showToast("Error starting quiz.", "error");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

export function init() {
    renderRecentHistory();
    
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
    document.querySelectorAll('.preset-topic').forEach(btn => {
        btn.addEventListener('click', () => {
            initiateQuizGeneration(btn.dataset.topic);
        });
    });
}

export function destroy() {
    const container = document.getElementById('recent-history-container');
    if (container && historyClickHandler) {
        container.removeEventListener('click', historyClickHandler);
    }
}
