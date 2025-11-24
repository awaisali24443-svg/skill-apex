

import * as apiService from '../../services/apiService.js';
import * as stateService from '../../services/stateService.js';
import * as modalService from '../../services/modalService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as levelCacheService from '../../services/levelCacheService.js';
import { showToast } from '../../services/toastService.js';

let topicGrid, activeJourneysGrid, activeJourneysSection, skeletonGrid, activeFilterContainer;
let template, activeJourneyTemplate;
let journeyCreatorForm;
let currentTopicsList = [];
let prefetchQueue = [];
let isPrefetching = false;
let prefetchTimeout = null;

// --- UI Rendering & Event Listeners ---

function renderTopics(topics) {
    currentTopicsList = topics;
    skeletonGrid.style.display = 'none';
    topicGrid.style.display = 'grid';
    topicGrid.innerHTML = '';
    
    if (!topics || topics.length === 0) {
        topicGrid.innerHTML = `<p>No topics available at the moment. Please try again later.</p>`;
        return;
    }

    topics.forEach((topic, index) => {
        const card = template.content.cloneNode(true);
        const cardEl = card.querySelector('.topic-card');
        cardEl.dataset.topic = topic.name;
        if (topic.styleClass) cardEl.classList.add(topic.styleClass);
        
        // Stagger animation for visual polish
        cardEl.style.animationDelay = `${index * 50}ms`;
        
        card.querySelector('.topic-name').textContent = topic.name;
        card.querySelector('.topic-description').textContent = topic.description;
        
        topicGrid.appendChild(card);
    });

    // Start Background Pre-fetching sequence
    initiatePrefetchSequence(topics);
}

// --- Background Pre-fetching Logic ---
function initiatePrefetchSequence(topics) {
    // Stop any existing sequence
    if (prefetchTimeout) clearTimeout(prefetchTimeout);
    
    // Prioritize top 6 topics for immediate responsiveness
    prefetchQueue = topics.slice(0, 6).map(t => t.name);
    processPrefetchQueue();
}

async function processPrefetchQueue() {
    // Stop if queue empty or component destroyed
    if (prefetchQueue.length === 0) return;
    if (!document.body.contains(topicGrid)) return; 

    const topicName = prefetchQueue.shift();
    const topicData = currentTopicsList.find(t => t.name === topicName);
    
    // Safety check: Only prefetch if we have metadata (totalLevels)
    // This ensures we are in the "Fast Track" mode.
    if (!topicData || !topicData.totalLevels) {
        processPrefetchQueue(); 
        return;
    }

    // Check if Level 1 is already in cache. If so, skip to next.
    if (levelCacheService.getLevel(topicName, 1)) {
        processPrefetchQueue();
        return;
    }

    try {
        // 1. Generate Questions
        const qData = await apiService.generateLevelQuestions({ 
            topic: topicName, 
            level: 1, 
            totalLevels: topicData.totalLevels 
        });

        // 2. Generate Lesson using the questions we just got
        const lData = await apiService.generateLevelLesson({ 
            topic: topicName, 
            level: 1, 
            totalLevels: topicData.totalLevels, 
            questions: qData.questions 
        });

        // 3. Save to Cache
        const fullLevelData = { ...qData, ...lData };
        levelCacheService.saveLevel(topicName, 1, fullLevelData);

    } catch (e) {
        // Silent fail in background
    } finally {
        // Schedule next fetch with a small delay to keep UI thread buttery smooth
        prefetchTimeout = setTimeout(processPrefetchQueue, 300);
    }
}

function renderActiveJourneys() {
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
        
        // Visual flair for active journeys
        const styles = ['topic-programming', 'topic-space', 'topic-biology', 'topic-arts', 'topic-finance', 'topic-robotics'];
        const styleIndex = journey.goal.length % styles.length;
        cardEl.classList.add(styles[styleIndex]);
        
        cardEl.style.animationDelay = `${index * 30}ms`;
        
        card.querySelector('.topic-name').textContent = journey.goal;
        card.querySelector('.journey-level').textContent = journey.currentLevel;
        
        const progress = Math.min(100, ((journey.currentLevel - 1) / journey.totalLevels) * 100);
        card.querySelector('.journey-progress-fill').style.width = `${progress}%`;
        
        activeJourneysGrid.appendChild(card);
    });
}

function handleTopicSelection(topicName) {
    if (!topicName) return;
    
    // 1. Check if we have metadata (totalLevels) for this topic
    const topicData = currentTopicsList.find(t => t.name === topicName);
    
    if (topicData && topicData.totalLevels) {
        // INSTANT JOURNEY CREATION
        learningPathService.startOrGetJourney(topicName, {
            totalLevels: topicData.totalLevels,
            description: topicData.description
        }).then(() => {
            stateService.setNavigationContext({ topic: topicName });
            window.location.hash = `#/game/${encodeURIComponent(topicName)}`;
        });
        return;
    }

    // Standard flow (API call inside game-map will handle generation)
    stateService.setNavigationContext({ topic: topicName });
    window.location.hash = `#/game/${encodeURIComponent(topicName)}`;
}

function handleGridInteraction(event) {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    
    const card = event.target.closest('.topic-card');
    if (!card) return;

    event.preventDefault();
    const topic = card.dataset.topic;
    handleTopicSelection(topic);
}

function handleClearFilter() {
    learningPathService.clearUserInterest();
    activeFilterContainer.style.display = 'none';
    skeletonGrid.style.display = 'grid';
    topicGrid.style.display = 'none';
    
    // Load generic topics
    apiService.fetchTopics().then(renderTopics).catch(err => {
        topicGrid.innerHTML = '<p>Error loading topics.</p>';
    });
    
    showToast('Filter cleared. Showing all topics.', 'info');
}

async function handleJourneyCreatorSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('custom-topic-input');
    const topic = input.value.trim();
    if (!topic) return;

    const button = journeyCreatorForm.querySelector('button[type="submit"]');
    const buttonText = button.querySelector('span');
    const buttonIcon = button.querySelector('svg');
    const originalButtonText = buttonText.textContent;
    const originalIconHTML = buttonIcon.innerHTML;

    // Show loading state on button
    button.disabled = true;
    buttonText.textContent = 'Generating...';
    buttonIcon.innerHTML = `<div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>`;

    try {
        const plan = await apiService.generateJourneyPlan(topic);
        const outline = await apiService.generateCurriculumOutline({ topic, totalLevels: plan.totalLevels });

        const curriculumHtml = `
            <p>The AI has designed a <strong>${plan.totalLevels}-level journey</strong> for "${topic}". Here is the proposed curriculum:</p>
            <ul class="curriculum-list">
                ${outline.chapters.map(chapter => `<li>${chapter}</li>`).join('')}
            </ul>
        `;

        const confirmed = await modalService.showConfirmationModal({
            title: 'Journey Preview',
            message: curriculumHtml,
            confirmText: 'Begin Journey',
            cancelText: 'Cancel'
        });

        if (confirmed) {
            await learningPathService.startOrGetJourney(topic, plan);
            handleTopicSelection(topic);
        }

    } catch (error) {
        showToast(`Error creating journey: ${error.message}`, 'error');
    } finally {
        button.disabled = false;
        buttonText.textContent = originalButtonText;
        buttonIcon.innerHTML = originalIconHTML;
        input.value = '';
    }
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

    topicGrid.addEventListener('click', handleGridInteraction);
    topicGrid.addEventListener('keydown', handleGridInteraction);
    activeJourneysGrid.addEventListener('click', handleGridInteraction);
    activeJourneysGrid.addEventListener('keydown', handleGridInteraction);
    journeyCreatorForm.addEventListener('submit', handleJourneyCreatorSubmit);
    
    const clearFilterBtn = document.getElementById('clear-filter-btn');
    if (clearFilterBtn) clearFilterBtn.addEventListener('click', handleClearFilter);
    
    renderActiveJourneys();

    skeletonGrid.style.display = 'grid';
    topicGrid.style.display = 'none';

    // 1. Check for user's SAVED interest (Persisted preference)
    const savedInterest = learningPathService.getUserInterest();
    
    if (savedInterest && savedInterest !== 'custom') {
        // Load instant data for that interest
        const topics = learningPathService.getInterestTopics(savedInterest);
        renderTopics(topics);
        
        // Show filter badge
        activeFilterContainer.style.display = 'flex';
        document.getElementById('filter-name').textContent = `Filtering: ${savedInterest.toUpperCase()}`;
    } else {
        activeFilterContainer.style.display = 'none';
        // 2. Fallback (or Custom): API fetch for generic topics
        try {
            const allTopics = await apiService.fetchTopics();
            renderTopics(allTopics);
        } catch (error) {
            skeletonGrid.style.display = 'none';
            topicGrid.style.display = 'block';
            topicGrid.innerHTML = `<p class="error-message">Could not load topics. Please try again later.</p>`;
        }
    }
}

export function destroy() {
    if (prefetchTimeout) {
        clearTimeout(prefetchTimeout);
        prefetchTimeout = null;
    }
    prefetchQueue = [];
}