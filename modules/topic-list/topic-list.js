
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
let isPrefetching = false;
let prefetchTimeout = null;

// AI Thinking Visualization for Journey Creation
let thinkingInterval = null;
const JOURNEY_THINKING_STEPS = [
    "Analyzing Concept...",
    "Determining Feasibility...",
    "Designing Curriculum...",
    "Structuring Journey..."
];

// Available styles defined in CSS
const STYLE_CLASSES = [
    'topic-programming', 
    'topic-space', 
    'topic-biology', 
    'topic-arts', 
    'topic-finance', 
    'topic-robotics',
    'topic-medicine',
    'topic-philosophy',
    'topic-ecology'
];

// Map styles to specific feather icons for the reference look
const ICON_MAP = {
    'topic-programming': 'cpu',     // Represents Microchip/Tech
    'topic-space': 'globe',         // Represents Planet/Cosmos
    'topic-biology': 'activity',    // Represents DNA/Pulse
    'topic-arts': 'image',          // Represents Palette/Art
    'topic-finance': 'trending-up', // Represents Chart/Growth
    'topic-robotics': 'server',     // Represents Machine/Bot
    'topic-medicine': 'heart',      // Represents Health
    'topic-philosophy': 'book-open',// Represents Logic/Law
    'topic-ecology': 'sun'          // Represents Environment/Nature
};

function renderTopics(topics) {
    if (!topicGrid) return; // Safety check
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
        
        let iconName = 'layers'; // Default fallback
        
        if (topic.styleClass) {
            cardEl.classList.add(topic.styleClass);
            if (ICON_MAP[topic.styleClass]) {
                iconName = ICON_MAP[topic.styleClass];
            }
        }
        
        cardEl.style.animationDelay = `${index * 50}ms`;
        
        // Inject Icon
        const iconContainer = cardEl.querySelector('.topic-icon-wrapper');
        if (iconContainer) {
            iconContainer.innerHTML = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#${iconName}"/></svg>`;
        }
        
        card.querySelector('.topic-name').textContent = topic.name;
        card.querySelector('.topic-description').textContent = topic.description;
        
        topicGrid.appendChild(card);
    });

    initiatePrefetchSequence(topics);
}

function initiatePrefetchSequence(topics) {
    if (prefetchTimeout) clearTimeout(prefetchTimeout);
    prefetchQueue = topics.slice(0, 6).map(t => t.name);
    processPrefetchQueue();
}

async function processPrefetchQueue() {
    if (prefetchQueue.length === 0) return;
    if (!document.body.contains(topicGrid)) return; 

    const topicName = prefetchQueue.shift();
    const topicData = currentTopicsList.find(t => t.name === topicName);
    
    if (!topicData || !topicData.totalLevels) {
        processPrefetchQueue(); 
        return;
    }

    if (levelCacheService.getLevel(topicName, 1)) {
        processPrefetchQueue();
        return;
    }

    try {
        const qData = await apiService.generateLevelQuestions({ 
            topic: topicName, 
            level: 1, 
            totalLevels: topicData.totalLevels 
        });

        const lData = await apiService.generateLevelLesson({ 
            topic: topicName, 
            level: 1, 
            totalLevels: topicData.totalLevels, 
            questions: qData.questions 
        });

        const fullLevelData = { ...qData, ...lData };
        levelCacheService.saveLevel(topicName, 1, fullLevelData);

    } catch (e) {
        // Silent fail
    } finally {
        prefetchTimeout = setTimeout(processPrefetchQueue, 300);
    }
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
        
        let styleClass;
        
        // 1. Check if journey has a saved visual style
        if (journey.styleClass) {
            styleClass = journey.styleClass;
        } else {
            // 2. Fallback: Assign a consistent style based on hash
            let styleIndex = 0;
            for (let i = 0; i < journey.goal.length; i++) {
                styleIndex += journey.goal.charCodeAt(i);
            }
            styleClass = STYLE_CLASSES[styleIndex % STYLE_CLASSES.length];
        }
        
        cardEl.classList.add(styleClass); // Still add class for consistency/data attributes if needed, though CSS overrides active card style
        
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
    
    const topicData = currentTopicsList.find(t => t.name === topicName);
    
    if (topicData && topicData.totalLevels) {
        learningPathService.startOrGetJourney(topicName, {
            totalLevels: topicData.totalLevels,
            description: topicData.description,
            styleClass: topicData.styleClass // Pass style from preset
        }).then(() => {
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
    const topic = card.dataset.topic;
    handleTopicSelection(topic);
}

function handleClearFilter() {
    learningPathService.clearUserInterest();
    activeFilterContainer.style.display = 'none';
    skeletonGrid.style.display = 'grid';
    topicGrid.style.display = 'none';
    
    apiService.fetchTopics().then(renderTopics).catch(err => {
        topicGrid.innerHTML = '<p>Error loading topics.</p>';
    });
    
    showToast('Filter cleared. Showing all topics.', 'info');
}

function setGeneratingState(isGenerating) {
    const buttonText = generateBtn.querySelector('span');
    const buttonIcon = generateBtn.querySelector('svg');
    const input = document.getElementById('custom-topic-input');

    if (isGenerating) {
        generateBtn.disabled = true;
        buttonIcon.innerHTML = `<div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>`;
        cameraBtn.disabled = true;
        input.disabled = true;
        
        // Start Thinking Animation
        let stepIndex = 0;
        buttonText.textContent = JOURNEY_THINKING_STEPS[0];
        
        if (thinkingInterval) clearInterval(thinkingInterval);
        
        thinkingInterval = setInterval(() => {
            stepIndex = (stepIndex + 1) % JOURNEY_THINKING_STEPS.length;
            buttonText.textContent = JOURNEY_THINKING_STEPS[stepIndex];
        }, 1200);

    } else {
        // Stop Thinking Animation
        if (thinkingInterval) {
            clearInterval(thinkingInterval);
            thinkingInterval = null;
        }

        generateBtn.disabled = false;
        buttonText.textContent = 'Generate';
        buttonIcon.innerHTML = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#arrow-right"/></svg>`; 
        cameraBtn.disabled = false;
        input.disabled = false;
    }
}

async function handleJourneyCreatorSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('custom-topic-input');
    const topic = input.value.trim();
    if (!topic) return;

    setGeneratingState(true);

    try {
        const plan = await apiService.generateJourneyPlan(topic);
        await confirmAndStartJourney(topic, plan);
    } catch (error) {
        showToast(`Error creating journey: ${error.message}`, 'error');
    } finally {
        setGeneratingState(false);
        input.value = '';
    }
}

async function confirmAndStartJourney(topic, plan) {
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
        // Assign a random style class for visual variety since we don't have metadata yet
        const randomStyle = STYLE_CLASSES[Math.floor(Math.random() * STYLE_CLASSES.length)];
        
        await learningPathService.startOrGetJourney(topic, {
            ...plan,
            styleClass: randomStyle // Persist this style
        });
        handleTopicSelection(topic);
    }
}

// --- File Handling (PDF/Images) ---
function handleCameraClick() {
    fileInput.click();
}

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset input so same file can be selected again if needed
    event.target.value = '';

    setGeneratingState(true);
    const btnText = generateBtn.querySelector('span');
    
    // Customize text based on file type
    if (file.type.includes('pdf')) {
        btnText.textContent = 'Reading PDF...';
    } else {
        btnText.textContent = 'Scanning Image...';
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = reader.result.split(',')[1]; // Remove metadata prefix
        const mimeType = file.type;

        try {
            // New Generic Function handles both PDF and Images
            const plan = await apiService.generateJourneyFromFile(base64String, mimeType);
            
            // Auto-fill the input with the detected topic so user sees what happened
            const input = document.getElementById('custom-topic-input');
            input.value = plan.topicName;
            
            await confirmAndStartJourney(plan.topicName, plan);
        } catch (error) {
            console.error("File analysis error", error);
            showToast(`Could not analyze file: ${error.message}`, 'error');
        } finally {
            setGeneratingState(false);
        }
    };
    reader.readAsDataURL(file);
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
    topicGrid.addEventListener('keydown', handleGridInteraction);
    activeJourneysGrid.addEventListener('click', handleGridInteraction);
    activeJourneysGrid.addEventListener('keydown', handleGridInteraction);
    
    journeyCreatorForm.addEventListener('submit', handleJourneyCreatorSubmit);
    cameraBtn.addEventListener('click', handleCameraClick);
    fileInput.addEventListener('change', handleFileSelect);
    
    const clearFilterBtn = document.getElementById('clear-filter-btn');
    if (clearFilterBtn) clearFilterBtn.addEventListener('click', handleClearFilter);
    
    renderActiveJourneys();

    skeletonGrid.style.display = 'grid';
    topicGrid.style.display = 'none';

    const savedInterest = learningPathService.getUserInterest();
    
    if (savedInterest && savedInterest !== 'custom') {
        const topics = learningPathService.getInterestTopics(savedInterest);
        renderTopics(topics);
        
        activeFilterContainer.style.display = 'flex';
        document.getElementById('filter-name').textContent = `Filtering: ${savedInterest.toUpperCase()}`;
    } else {
        activeFilterContainer.style.display = 'none';
        try {
            const allTopics = await apiService.fetchTopics();
            renderTopics(allTopics);
        } catch (error) {
            skeletonGrid.style.display = 'none';
            topicGrid.style.display = 'block';
            topicGrid.innerHTML = `<p class="error-message">Could not load topics. Please try again later.</p>`;
        }
    }

    window.addEventListener('journeys-updated', renderActiveJourneys);
}

export function destroy() {
    window.removeEventListener('journeys-updated', renderActiveJourneys);
    if (thinkingInterval) {
        clearInterval(thinkingInterval);
        thinkingInterval = null;
    }
    if (prefetchTimeout) {
        clearTimeout(prefetchTimeout);
        prefetchTimeout = null;
    }
    prefetchQueue = [];
}
