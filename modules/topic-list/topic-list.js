import * as apiService from '../../services/apiService.js';
import * as stateService from '../../services/stateService.js';
import * as modalService from '../../services/modalService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as levelCacheService from '../../services/levelCacheService.js';
import { showToast } from '../../services/toastService.js';

let topicGrid, activeJourneysGrid, activeJourneysSection, skeletonGrid, activeFilterContainer;
let template, activeJourneyTemplate;
let journeyCreatorForm, cameraBtn, fileInput, generateBtn;
let currentTopicsList = [];
let prefetchQueue = [];
let prefetchTimeout = null;

let thinkingInterval = null;
const JOURNEY_THINKING_STEPS = ["Analyzing Concept...", "Determining Feasibility...", "Designing Curriculum...", "Structuring Journey..."];
const STYLE_CLASSES = ['topic-programming', 'topic-space', 'topic-biology', 'topic-arts', 'topic-finance', 'topic-robotics', 'topic-medicine', 'topic-philosophy', 'topic-ecology'];
const ICON_MAP = {
    'topic-programming': 'cpu', 'topic-space': 'globe', 'topic-biology': 'activity', 'topic-arts': 'image', 'topic-finance': 'trending-up', 'topic-robotics': 'server', 'topic-medicine': 'heart', 'topic-philosophy': 'book-open', 'topic-ecology': 'sun'
};

function renderTopics(topics) {
    if (!topicGrid) return;
    currentTopicsList = topics;
    skeletonGrid.style.display = 'none';
    topicGrid.style.display = 'grid';
    topicGrid.innerHTML = '';
    
    topics.forEach((topic, index) => {
        const card = template.content.cloneNode(true);
        const cardEl = card.querySelector('.topic-card');
        cardEl.dataset.topic = topic.name;
        let iconName = 'layers';
        if (topic.styleClass) {
            cardEl.classList.add(topic.styleClass);
            if (ICON_MAP[topic.styleClass]) iconName = ICON_MAP[topic.styleClass];
        }
        cardEl.style.animationDelay = `${index * 50}ms`;
        const iconContainer = cardEl.querySelector('.topic-icon-wrapper');
        if (iconContainer) iconContainer.innerHTML = `<svg class="icon"><use href="#${iconName}"/></svg>`;
        card.querySelector('.topic-name').textContent = topic.name;
        card.querySelector('.topic-description').textContent = topic.description;
        topicGrid.appendChild(card);
    });
    initiatePrefetchSequence(topics);
}

function renderActiveJourneys() {
    if (!activeJourneysSection) return;
    const journeys = learningPathService.getAllJourneys();
    if (!journeys || journeys.length === 0) {
        activeJourneysSection.style.display = 'none';
        return;
    }
    activeJourneysSection.style.display = 'block';
    activeJourneysGrid.innerHTML = '';
    journeys.forEach((journey, index) => {
        const card = activeJourneyTemplate.content.cloneNode(true);
        const cardEl = card.querySelector('.topic-card');
        cardEl.dataset.topic = journey.goal;
        cardEl.style.animationDelay = `${index * 30}ms`;
        card.querySelector('.topic-name').textContent = journey.goal;
        card.querySelector('.journey-level').textContent = journey.currentLevel;
        const progress = Math.min(100, ((journey.currentLevel - 1) / journey.totalLevels) * 100);
        card.querySelector('.journey-progress-fill').style.width = `${progress}%`;
        activeJourneysGrid.appendChild(card);
    });
}

function handleTopicSelection(topicName) {
    const topicData = currentTopicsList.find(t => t.name === topicName);
    if (topicData && topicData.totalLevels) {
        learningPathService.startOrGetJourney(topicName, { totalLevels: topicData.totalLevels, description: topicData.description, styleClass: topicData.styleClass }).then(() => {
            stateService.setNavigationContext({ topic: topicName });
            window.location.hash = `#/game/${encodeURIComponent(topicName)}`;
        });
        return;
    }
    stateService.setNavigationContext({ topic: topicName });
    window.location.hash = `#/game/${encodeURIComponent(topicName)}`;
}

function handleGridInteraction(event) {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.topic-card');
    if (!card) return;
    event.preventDefault();
    handleTopicSelection(card.dataset.topic);
}

async function handleJourneyCreatorSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('custom-topic-input');
    const topic = input.value.trim();
    if (!topic) return;
    setGeneratingState(true);
    try {
        const plan = await apiService.generateJourneyPlan(topic);
        const outline = await apiService.generateCurriculumOutline({ topic, totalLevels: plan.totalLevels });
        const confirmed = await modalService.showConfirmationModal({
            title: 'Journey Preview',
            message: `<p>${plan.totalLevels} levels for "${topic}".</p><ul>${outline.chapters.map(c => `<li>${c}</li>`).join('')}</ul>`,
            confirmText: 'Begin', cancelText: 'Cancel'
        });
        if (confirmed) {
            const randomStyle = STYLE_CLASSES[Math.floor(Math.random() * STYLE_CLASSES.length)];
            await learningPathService.startOrGetJourney(topic, { ...plan, styleClass: randomStyle });
            handleTopicSelection(topic);
        }
    } catch (error) { showToast(`Error: ${error.message}`, 'error'); }
    finally { setGeneratingState(false); input.value = ''; }
}

function setGeneratingState(isGenerating) {
    const buttonText = generateBtn.querySelector('span');
    const buttonIcon = generateBtn.querySelector('svg');
    if (isGenerating) {
        generateBtn.disabled = true;
        buttonIcon.innerHTML = `<div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>`;
        let stepIndex = 0;
        thinkingInterval = setInterval(() => { stepIndex = (stepIndex + 1) % JOURNEY_THINKING_STEPS.length; buttonText.textContent = JOURNEY_THINKING_STEPS[stepIndex]; }, 1200);
    } else {
        if (thinkingInterval) clearInterval(thinkingInterval);
        generateBtn.disabled = false;
        buttonText.textContent = 'Generate';
        buttonIcon.innerHTML = `<svg class="icon"><use href="#arrow-right"/></svg>`; 
    }
}

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    setGeneratingState(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = reader.result.split(',')[1];
        try {
            const plan = await apiService.generateJourneyFromFile(base64String, file.type);
            document.getElementById('custom-topic-input').value = plan.topicName;
            handleJourneyCreatorSubmit(new Event('submit'));
        } catch (e) { showToast('Scan failed.', 'error'); }
        finally { setGeneratingState(false); }
    };
    reader.readAsDataURL(file);
}

function initiatePrefetchSequence(topics) {
    if (prefetchTimeout) clearTimeout(prefetchTimeout);
    prefetchQueue = topics.slice(0, 6).map(t => t.name);
    processPrefetchQueue();
}

async function processPrefetchQueue() {
    if (prefetchQueue.length === 0 || !document.body.contains(topicGrid)) return;
    const topicName = prefetchQueue.shift();
    const topicData = currentTopicsList.find(t => t.name === topicName);
    if (!topicData || !topicData.totalLevels || levelCacheService.getLevel(topicName, 1)) { processPrefetchQueue(); return; }
    try {
        const qData = await apiService.generateLevelQuestions({ topic: topicName, level: 1, totalLevels: topicData.totalLevels });
        const lData = await apiService.generateLevelLesson({ topic: topicName, level: 1, totalLevels: topicData.totalLevels });
        levelCacheService.saveLevel(topicName, 1, { ...qData, ...lData });
    } catch (e) {} finally { prefetchTimeout = setTimeout(processPrefetchQueue, 300); }
}

export async function init() {
    topicGrid = document.getElementById('topic-grid-container');
    skeletonGrid = document.getElementById('topics-skeleton');
    activeJourneysGrid = document.getElementById('active-journeys-grid');
    activeJourneysSection = document.getElementById('active-journeys-section');
    activeFilterContainer = document.getElementById('active-filter-container');
    template = document.getElementById('topic-card-template');
    activeJourneyTemplate = document.getElementById('active-journey-template');
    journeyCreatorForm = document.getElementById('journey-creator-form');
    cameraBtn = document.getElementById('camera-btn');
    fileInput = document.getElementById('image-upload-input');
    generateBtn = document.getElementById('generate-btn');

    topicGrid.addEventListener('click', handleGridInteraction);
    activeJourneysGrid.addEventListener('click', handleGridInteraction);
    journeyCreatorForm.addEventListener('submit', handleJourneyCreatorSubmit);
    cameraBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    renderActiveJourneys();
    const savedInterest = learningPathService.getUserInterest();
    if (savedInterest && savedInterest !== 'custom') {
        renderTopics(learningPathService.getInterestTopics(savedInterest));
        activeFilterContainer.style.display = 'flex';
        document.getElementById('filter-name').textContent = `Filtering: ${savedInterest.toUpperCase()}`;
    } else {
        activeFilterContainer.style.display = 'none';
        apiService.fetchTopics().then(renderTopics).catch(() => { skeletonGrid.style.display = 'none'; topicGrid.style.display = 'block'; });
    }
    window.addEventListener('journeys-updated', renderActiveJourneys);
}

export function destroy() {
    window.removeEventListener('journeys-updated', renderActiveJourneys);
    if (thinkingInterval) clearInterval(thinkingInterval);
    if (prefetchTimeout) clearTimeout(prefetchTimeout);
}
