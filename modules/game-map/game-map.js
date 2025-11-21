
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';

const LEVELS_PER_CHAPTER = 50;
let journey, elements;
let currentChapter = 1; 
let keyboardNavHandler;

// --- Render Functions ---

function render() {
    elements.topicTitle.textContent = journey.goal;
    const totalProgress = Math.round(((journey.currentLevel - 1) / journey.totalLevels) * 100);
    elements.progressFill.style.width = `${totalProgress}%`;
    elements.progressText.textContent = `${totalProgress}%`;

    renderLevels(currentChapter);
    updateChapterNavigator();
}


function renderLevels(chapter) {
    elements.grid.className = 'map-grid'; 
    elements.grid.innerHTML = '';

    const template = elements.levelNodeTemplate.content;
    const startLevel = (chapter - 1) * LEVELS_PER_CHAPTER + 1;
    const endLevel = Math.min(chapter * LEVELS_PER_CHAPTER, journey.totalLevels);


    for (let i = startLevel; i <= endLevel; i++) {
        const node = template.cloneNode(true);
        const nodeEl = node.querySelector('.level-card');
        nodeEl.dataset.level = i;
        nodeEl.style.animationDelay = `${(i - startLevel) * 15}ms`;

        const numberEl = nodeEl.querySelector('.level-number');
        const statusEl = nodeEl.querySelector('.level-status');
        
        const isBoss = i % LEVELS_PER_CHAPTER === 0 || i === journey.totalLevels;
        if (isBoss) {
            nodeEl.classList.add('boss');
            numberEl.innerHTML = `<svg class="icon"><use href="/assets/icons/feather-sprite.svg#shield"/></svg>`;
        } else {
            numberEl.textContent = i;
        }

        if (i < journey.currentLevel) {
            nodeEl.classList.add('completed');
            statusEl.textContent = 'Done';
        } else if (i === journey.currentLevel) {
            nodeEl.classList.add('current');
            statusEl.textContent = 'Next';
        } else {
            nodeEl.classList.add('locked');
            statusEl.textContent = 'Locked';
        }
        elements.grid.appendChild(node);
    }

    elements.primaryActionBtn.disabled = journey.currentLevel > journey.totalLevels;
    elements.primaryActionBtnText.textContent = `Start Level ${journey.currentLevel}`;
}

function updateChapterNavigator() {
    elements.chapterDisplay.textContent = `Chapter ${currentChapter}`;
    elements.prevChapterBtn.disabled = currentChapter === 1;
    const totalChapters = Math.ceil(journey.totalLevels / LEVELS_PER_CHAPTER);
    elements.nextChapterBtn.disabled = currentChapter >= totalChapters;
}

// --- Event Handlers ---

function navigateToLevel(level) {
    const isBoss = (level % LEVELS_PER_CHAPTER === 0) || (level === journey.totalLevels);
    stateService.setNavigationContext({
        topic: journey.goal,
        level: level,
        journeyId: journey.id,
        isBoss: isBoss,
        totalLevels: journey.totalLevels,
    });
    window.location.hash = '#/level';
}

function handleInteraction(event) {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    
    const levelCard = event.target.closest('.level-card');
    if (levelCard && !levelCard.classList.contains('locked')) {
        event.preventDefault();
        const level = parseInt(levelCard.dataset.level, 10);
        navigateToLevel(level);
    }
}

function handleKeyboardNavigation(e) {
    const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!validKeys.includes(e.key)) return;
    
    e.preventDefault();

    const focusable = Array.from(elements.grid.querySelectorAll('.card:not(.locked)'));
    const currentFocus = document.activeElement;
    let currentIndex = focusable.indexOf(currentFocus);
    
    if (currentIndex === -1) {
        focusable[0]?.focus();
        return;
    }
    
    const gridStyle = window.getComputedStyle(elements.grid);
    const columns = gridStyle.getPropertyValue('grid-template-columns').split(' ').length;

    let nextIndex;
    switch (e.key) {
        case 'ArrowUp':
            nextIndex = currentIndex - columns;
            break;
        case 'ArrowDown':
            nextIndex = currentIndex + columns;
            break;
        case 'ArrowLeft':
            nextIndex = currentIndex - 1;
            break;
        case 'ArrowRight':
            nextIndex = currentIndex + 1;
            break;
    }

    if (nextIndex >= 0 && nextIndex < focusable.length) {
        const nextElement = focusable[nextIndex];
        nextElement.focus({ preventScroll: true });
        nextElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
}

function handlePrevChapter() {
    if (currentChapter > 1) {
        currentChapter--;
        render();
    }
}

function handleNextChapter() {
    const totalChapters = Math.ceil(journey.totalLevels / LEVELS_PER_CHAPTER);
    if (currentChapter < totalChapters) {
        currentChapter++;
        render();
    }
}

function handleFooterBackClick() {
    window.location.hash = '#/topics';
}

function handleFooterPrimaryClick() {
    if (journey.currentLevel > journey.totalLevels) return;
    
    const nextLevelChapter = Math.ceil(journey.currentLevel / LEVELS_PER_CHAPTER);
    if (currentChapter !== nextLevelChapter) {
        currentChapter = nextLevelChapter;
        render();
    }
    navigateToLevel(journey.currentLevel);
}


// --- Lifecycle ---

export async function init() {
    const { routeParams, navigationContext } = stateService.getState();
    const topic = routeParams.topic || navigationContext.topic;

    if (!topic) {
        console.error("No topic found for game map, redirecting.");
        window.location.hash = '/topics';
        return;
    }
    
    elements = {
        loadingState: document.getElementById('journey-loading-state'),
        skeletonState: document.getElementById('journey-skeleton-state'),
        journeyContent: document.getElementById('journey-content'),
        topicTitle: document.getElementById('game-map-topic-title'),
        progressFill: document.getElementById('progress-bar-fill'),
        progressText: document.getElementById('progress-percent-text'),
        grid: document.getElementById('map-grid'),
        backBtn: document.getElementById('back-btn'),
        primaryActionBtn: document.getElementById('primary-action-btn'),
        primaryActionBtnText: document.getElementById('primary-action-btn-text'),
        levelNodeTemplate: document.getElementById('level-node-template'),
        chapterDisplay: document.getElementById('current-chapter-display'),
        prevChapterBtn: document.getElementById('prev-chapter-btn'),
        nextChapterBtn: document.getElementById('next-chapter-btn'),
    };
    
    try {
        // 1. Check if we need to fetch (API call) or if it's likely instant
        const isCached = learningPathService.getJourneyByGoal(decodeURIComponent(topic));
        
        if (!isCached) {
            elements.loadingState.style.display = 'flex'; // Show spinner for new generation
        } else {
            elements.skeletonState.style.display = 'flex'; // Show skeleton for quick DB/LocalStorage fetch
            elements.loadingState.style.display = 'none';
        }

        journey = await learningPathService.startOrGetJourney(decodeURIComponent(topic));
        
        elements.loadingState.style.display = 'none';
        elements.skeletonState.style.display = 'none';
        elements.journeyContent.style.display = 'flex'; // Show real content
        
        const initialChapter = Math.ceil(journey.currentLevel / LEVELS_PER_CHAPTER);
        currentChapter = navigationContext.chapter || initialChapter;
    
        render();
        
        elements.grid.addEventListener('click', handleInteraction);
        elements.grid.addEventListener('keydown', handleInteraction);
        
        keyboardNavHandler = handleKeyboardNavigation;
        document.addEventListener('keydown', keyboardNavHandler);
        
        elements.backBtn.addEventListener('click', handleFooterBackClick);
        elements.primaryActionBtn.addEventListener('click', handleFooterPrimaryClick);
    
        elements.prevChapterBtn.addEventListener('click', handlePrevChapter);
        elements.nextChapterBtn.addEventListener('click', handleNextChapter);

    } catch (error) {
        console.error('Failed to initialize journey:', error);
        elements.loadingState.innerHTML = `<p class="error-message">Could not create journey: ${error.message}</p><a href="#/topics" class="btn">Back to Topics</a>`;
        elements.skeletonState.style.display = 'none';
    }
}

export function destroy() {
    if (keyboardNavHandler) {
        document.removeEventListener('keydown', keyboardNavHandler);
    }
}
