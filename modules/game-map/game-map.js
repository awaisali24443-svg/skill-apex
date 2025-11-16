

import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';

const LEVELS_PER_CHAPTER = 50;
let journey, elements;
let currentChapter = null; // null for chapter view, or chapter number for level view
let keyboardNavHandler;

// --- Render Functions ---

function render() {
    elements.topicTitle.textContent = journey.goal;
    const totalProgress = Math.round(((journey.currentLevel - 1) / journey.totalLevels) * 100);
    elements.progressFill.style.width = `${totalProgress}%`;
    elements.progressText.textContent = `${totalProgress}%`;

    if (currentChapter === null) {
        renderChapters();
    } else {
        renderLevels(currentChapter);
    }
}

function renderChapters() {
    elements.subtitle.textContent = `A ${journey.totalLevels}-Level Journey`;
    elements.grid.className = 'map-grid chapters-view';
    elements.grid.innerHTML = '';
    
    const template = elements.chapterCardTemplate.content;
    const totalChapters = journey.totalLevels / LEVELS_PER_CHAPTER;
    const currentChapterForUser = Math.ceil(journey.currentLevel / LEVELS_PER_CHAPTER);

    for (let i = 1; i <= totalChapters; i++) {
        const card = template.cloneNode(true);
        const cardEl = card.querySelector('.chapter-card');
        cardEl.dataset.chapter = i;
        cardEl.style.animationDelay = `${(i - 1) * 30}ms`;

        const startLevel = (i - 1) * LEVELS_PER_CHAPTER + 1;
        const endLevel = i * LEVELS_PER_CHAPTER;
        
        cardEl.querySelector('.chapter-title').textContent = `Chapter ${i}`;
        cardEl.querySelector('.chapter-levels').textContent = `Levels ${startLevel}-${endLevel}`;
        
        const statusEl = cardEl.querySelector('.chapter-status');
        const progressFill = cardEl.querySelector('.chapter-progress-bar-fill');
        
        if (i < currentChapterForUser) {
            cardEl.classList.add('completed');
            statusEl.textContent = 'Completed';
            progressFill.style.width = '100%';
        } else if (i === currentChapterForUser) {
            cardEl.classList.add('current');
            statusEl.textContent = 'In Progress';
            const levelsCompletedInChapter = (journey.currentLevel - 1) % LEVELS_PER_CHAPTER;
            progressFill.style.width = `${(levelsCompletedInChapter / LEVELS_PER_CHAPTER) * 100}%`;
        } else {
            cardEl.classList.add('locked');
            statusEl.textContent = 'Locked';
            progressFill.style.width = '0%';
        }
        elements.grid.appendChild(card);
    }
    
    // Update footer for chapter view
    elements.backBtnText.textContent = 'Back to Topics';
    elements.primaryActionBtn.disabled = journey.currentLevel > journey.totalLevels;
    elements.primaryActionBtnText.textContent = `Continue Level ${journey.currentLevel}`;
}

function renderLevels(chapter) {
    elements.subtitle.textContent = `Chapter ${chapter}: Levels ${(chapter - 1) * LEVELS_PER_CHAPTER + 1} - ${chapter * LEVELS_PER_CHAPTER}`;
    elements.grid.className = 'map-grid levels-view';
    elements.grid.innerHTML = '';

    const template = elements.levelNodeTemplate.content;
    const startLevel = (chapter - 1) * LEVELS_PER_CHAPTER + 1;
    const endLevel = chapter * LEVELS_PER_CHAPTER;

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

    // Update footer for level view
    elements.backBtnText.textContent = 'Back to Chapters';
    elements.primaryActionBtn.disabled = journey.currentLevel > journey.totalLevels;
    elements.primaryActionBtnText.textContent = `Start Level ${journey.currentLevel}`;
}

// --- Event Handlers ---

function navigateToLevel(level) {
    const isBoss = (level % LEVELS_PER_CHAPTER === 0) || (level === journey.totalLevels);
    stateService.setNavigationContext({
        topic: journey.goal,
        level: level,
        journeyId: journey.id,
        isBoss: isBoss,
    });
    window.location.hash = '#/level';
}

function handleInteraction(event) {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    
    const targetCard = event.target.closest('.chapter-card, .level-card');
    if (!targetCard) return;
    
    event.preventDefault();

    if (currentChapter === null) { // We are in chapter view
        const chapterCard = event.target.closest('.chapter-card');
        if (chapterCard && !chapterCard.classList.contains('locked')) {
            currentChapter = parseInt(chapterCard.dataset.chapter, 10);
            render();
        }
    } else { // We are in level view
        const levelCard = event.target.closest('.level-card');
        if (levelCard && !levelCard.classList.contains('locked')) {
            const level = parseInt(levelCard.dataset.level, 10);
            navigateToLevel(level);
        }
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


function handleFooterBackClick() {
    if (currentChapter === null) {
        window.location.hash = '#/topics';
    } else {
        currentChapter = null;
        render();
    }
}

function handleFooterPrimaryClick() {
    if (journey.currentLevel > journey.totalLevels) return;
    
    const nextLevelChapter = Math.ceil(journey.currentLevel / LEVELS_PER_CHAPTER);
    if (currentChapter !== nextLevelChapter) {
        // If user is in chapter view or a different chapter, switch to the correct one and render levels
        currentChapter = nextLevelChapter;
        render();
    } else {
        // If already in the correct chapter view, just go to the level
        navigateToLevel(journey.currentLevel);
    }
}


// --- Lifecycle ---

export function init() {
    const { routeParams, navigationContext } = stateService.getState();
    const topic = routeParams.topic || navigationContext.topic;

    if (!topic) {
        console.error("No topic found for game map, redirecting.");
        window.location.hash = '/topics';
        return;
    }
    
    journey = learningPathService.startOrGetJourney(decodeURIComponent(topic));

    elements = {
        topicTitle: document.getElementById('game-map-topic-title'),
        subtitle: document.getElementById('game-map-subtitle'),
        progressFill: document.getElementById('progress-bar-fill'),
        progressText: document.getElementById('progress-percent-text'),
        grid: document.getElementById('map-grid'),
        backBtn: document.getElementById('back-btn'),
        backBtnText: document.getElementById('back-btn-text'),
        primaryActionBtn: document.getElementById('primary-action-btn'),
        primaryActionBtnText: document.getElementById('primary-action-btn-text'),
        levelNodeTemplate: document.getElementById('level-node-template'),
        chapterCardTemplate: document.getElementById('chapter-card-template'),
    };

    // Decide initial view
    currentChapter = navigationContext.chapter || null;

    render();
    
    elements.grid.addEventListener('click', handleInteraction);
    elements.grid.addEventListener('keydown', handleInteraction);
    
    keyboardNavHandler = handleKeyboardNavigation;
    document.addEventListener('keydown', keyboardNavHandler);
    
    elements.backBtn.addEventListener('click', handleFooterBackClick);
    elements.primaryActionBtn.addEventListener('click', handleFooterPrimaryClick);
}

export function destroy() {
    if (keyboardNavHandler) {
        document.removeEventListener('keydown', keyboardNavHandler);
    }
}