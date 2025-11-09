import { getProgress, calculateLevelInfo } from '../../services/progressService.js';
import { getActiveMissions } from '../../services/missionService.js';
import { generateLearningPath } from '../../services/geminiService.js';
import { saveLearningPath, getActiveLearningPaths } from '../../services/learningPathService.js';
import { MODULE_CONTEXT_KEY } from '../../constants.js';

const welcomeMessage = document.getElementById('welcome-message');
const playerLevelBadge = document.getElementById('player-level-badge');
const playerXpBar = document.getElementById('player-xp-bar');
const playerXpText = document.getElementById('player-xp-text');
const playerStreakText = document.getElementById('player-streak-text');
const missionsList = document.getElementById('missions-list');
const learningPathForm = document.getElementById('learning-path-form');
const generatePathBtn = document.getElementById('generate-path-btn');
const learningGoalInput = document.getElementById('learning-goal-input');
const learningPathsList = document.getElementById('learning-paths-list');

async function renderWelcome() {
    const progress = await getProgress(true);
    if (!progress || !welcomeMessage) return;

    welcomeMessage.textContent = `Welcome, ${progress.username || 'Agent'}!`;
    
    const { level, progressPercentage, currentLevelXP, xpForNextLevel } = calculateLevelInfo(progress.xp);
    playerLevelBadge.textContent = `LVL ${level}`;
    playerXpBar.style.width = `${progressPercentage}%`;
    playerXpText.textContent = `${currentLevelXP.toLocaleString()} / ${xpForNextLevel.toLocaleString()} XP`;
    playerStreakText.textContent = `🔥 ${progress.streak} Day Streak`;
}

async function renderMissions() {
    if (!missionsList) return;
    const missions = await getActiveMissions();
    
    if (missions.length === 0) {
        missionsList.innerHTML = '<div class="mission-placeholder">No new missions today. Check back tomorrow!</div>';
        return;
    }

    missionsList.innerHTML = missions.map(mission => `
        <div class="mission-card ${mission.isComplete ? 'completed' : ''}">
            <div class="mission-info"><p>${mission.description}</p></div>
            <div class="mission-reward">+${mission.reward} XP</div>
        </div>
    `).join('');
}

async function renderLearningPaths() {
    if (!learningPathsList) return;
    const paths = await getActiveLearningPaths();
    
    if (paths.length === 0) {
        learningPathsList.innerHTML = '<div class="mission-placeholder">You have no active learning paths.</div>';
        return;
    }

    learningPathsList.innerHTML = paths.map(path => {
        const progress = path.currentStep >= path.steps.length ? 'Complete' : `${path.currentStep}/${path.steps.length} Steps`;
        return `
        <a href="#learning-path" class="learning-path-item" data-path-id="${path.id}">
            <div class="path-item-info">
                <strong>${path.title}</strong>
            </div>
            <div class="path-item-progress">
                ${progress}
            </div>
        </a>
    `}).join('');
    
    document.querySelectorAll('.learning-path-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.setItem(MODULE_CONTEXT_KEY, JSON.stringify({ pathId: item.dataset.pathId }));
            window.location.hash = '#learning-path';
        });
    });
}

function setPlannerLoading(isLoading) {
    if (!generatePathBtn) return;
    const btnText = generatePathBtn.querySelector('.btn-text');
    const spinner = generatePathBtn.querySelector('.spinner');
    generatePathBtn.disabled = isLoading;
    btnText.classList.toggle('hidden', isLoading);
    spinner.classList.toggle('hidden', !isLoading);
}

async function handleGeneratePath(e) {
    e.preventDefault();
    const goal = learningGoalInput.value.trim();
    if (!goal) return;

    setPlannerLoading(true);
    try {
        const pathData = await generateLearningPath(goal);
        await saveLearningPath(pathData);
        window.showToast("✅ Learning path created successfully!", "success");
        learningGoalInput.value = '';
        await renderLearningPaths(); // Refresh the list
    } catch (error) {
        window.showToast(`❌ ${error.message}`, 'error');
    } finally {
        setPlannerLoading(false);
    }
}

export function init() {
    renderWelcome();
    renderMissions();
    renderLearningPaths();
    learningPathForm?.addEventListener('submit', handleGeneratePath);
}

export function cleanup() {
    learningPathForm?.removeEventListener('submit', handleGeneratePath);
}
