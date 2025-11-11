import { getSetting } from '../../services/configService.js';
import { threeManager } from '../../services/threeManager.js';
import { isFeatureEnabled } from '../../services/featureService.js';
import { getCategories, getTopicsForCategory } from '../../services/topicService.js';

let is3DInitialized = false;
let homeContainer;
let appStateRef;
let cardEventListeners = [];

const handleMouseMove = (event) => {
    if (is3DInitialized) {
        // Normalize mouse position to a -1 to 1 range
        const x = (event.clientX / window.innerWidth) * 2 - 1;
        const y = -(event.clientY / window.innerHeight) * 2 + 1;
        threeManager.updateMousePosition(x, y);
    }
};


// Centralized dashboard configuration
const dashboardItems = [
    {
        href: '#custom-quiz',
        icon: '🚀',
        title: 'Custom Quiz',
        description: 'Challenge yourself on any topic. Our AI will generate a unique quiz for you in seconds.',
        size: 'large',
    },
    {
        href: '#library',
        icon: '📚',
        title: 'My Library',
        description: 'Review your saved questions and prepare for tests.',
    },
    {
        href: '#study',
        icon: '🧠',
        title: 'Study Mode',
        description: 'Use flashcards to master your saved questions.',
        feature: 'studyMode'
    },
    {
        href: '#paths',
        icon: '🗺️',
        title: 'Learning Paths',
        description: 'Follow a structured journey to master a new subject.',
        feature: 'learningPaths'
    },
    {
        href: '#settings',
        icon: '⚙️',
        title: 'Settings',
        description: 'Customize your theme, accessibility, and experience.',
    }
];

const handleGridClick = (e) => {
    const topicCard = e.target.closest('a.dashboard-card[data-topic]');
    if (topicCard) {
        e.preventDefault();
        const topic = topicCard.dataset.topic;
        if (appStateRef) {
            appStateRef.context = { topic };
            window.location.hash = '#loading';
        }
    }
};

const handleCardMouseMove = (e) => {
    const card = e.currentTarget;
    const { left, top, width, height } = card.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;

    const rotateX = (y / height - 0.5) * -25; // Tilt intensity
    const rotateY = (x / width - 0.5) * 25;

    card.style.transition = 'transform 0.1s linear';
    card.style.transform = `translateY(-5px) scale(1.03) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
};

const handleCardMouseLeave = (e) => {
    const card = e.currentTarget;
    card.style.transition = `transform ${getComputedStyle(card).getPropertyValue('--transition-med')} ease-out`;
    card.style.transform = `translateY(0) scale(1) rotateX(0) rotateY(0)`;
};

async function renderDashboard() {
    const mainGridContainer = document.getElementById('dashboard-grid');
    const featuredTopicsSection = document.getElementById('featured-topics-section');
    const featuredTopicsGrid = document.getElementById('featured-topics-grid');

    if (!mainGridContainer || !featuredTopicsGrid) return;

    // 1. Render static action cards
    const staticCardsHtml = dashboardItems.map(item => {
        const isEnabled = !item.feature || isFeatureEnabled(item.feature);
        const isComingSoon = item.feature === 'learningPaths' && !isEnabled;

        if (!isEnabled && !isComingSoon) return '';

        const tag = isComingSoon ? 'div' : 'a';
        const href = isComingSoon ? '' : `href="${item.href}"`;
        const extraClasses = `${item.size === 'large' ? 'large' : ''} ${isComingSoon ? 'coming-soon' : ''}`;
        const content = item.size === 'large' ? `
            <div class="card-icon">${item.icon}</div>
            <div class="card-content">
                <h3>${item.title}</h3>
                <p>${item.description}</p>
            </div>
        ` : `
            <div class="card-icon">${item.icon}</div>
            <div class="card-content">
                <h3>${item.title}</h3>
                <p>${item.description}</p>
                ${isComingSoon ? `<div class="card-footer"><span class="coming-soon-tag">Coming Soon</span></div>` : ''}
            </div>
        `;
        return `<${tag} ${href} class="dashboard-card ${extraClasses}">${content}</${tag}>`;
    }).join('');
    mainGridContainer.innerHTML = staticCardsHtml;

    // 2. Render featured topic cards
    try {
        const categories = await getCategories();
        const allTopicsPromises = categories.map(cat => getTopicsForCategory(cat.id));
        const allTopicsArrays = await Promise.all(allTopicsPromises);
        const allTopics = allTopicsArrays.flat();
        
        if (allTopics.length > 0) {
            const topicCardsHtml = allTopics.map(topic => `
                <a href="#loading" class="dashboard-card" data-topic="${topic.name}">
                     <div class="card-icon">🧠</div>
                     <div class="card-content">
                        <h3>${topic.name}</h3>
                        <p>${topic.description}</p>
                    </div>
                </a>
            `).join('');
            featuredTopicsGrid.innerHTML = topicCardsHtml;
            featuredTopicsSection.style.display = 'block';
        }
    } catch (error) {
        console.error("Could not load topics for home screen", error);
    }
    
    // 3. Apply animations and effects to all cards
    const allCards = document.querySelectorAll('.home-content .dashboard-card');
    allCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 100}ms`;
        if (!card.classList.contains('coming-soon')) {
            card.addEventListener('mousemove', handleCardMouseMove);
            card.addEventListener('mouseleave', handleCardMouseLeave);
            cardEventListeners.push({ element: card, type: 'mousemove', handler: handleCardMouseMove });
            cardEventListeners.push({ element: card, type: 'mouseleave', handler: handleCardMouseLeave });
        }
    });
}


export async function init(appState) {
    console.log("Home module initialized.");
    appStateRef = appState;
    homeContainer = document.querySelector('.home-container');
    
    await renderDashboard();
    
    const contentArea = document.querySelector('.home-content');
    if (contentArea) {
        contentArea.addEventListener('click', handleGridClick);
    }

    const use3DBackground = getSetting('enable3DBackground');
    const canvas = document.getElementById('bg-canvas');

    if (use3DBackground && homeContainer && canvas) {
        try {
            console.log("Initializing 3D background...");
            threeManager.init(homeContainer);
            canvas.classList.add('visible');
            is3DInitialized = true;
            homeContainer.addEventListener('mousemove', handleMouseMove);
        } catch (error) {
            console.error("Failed to initialize 3D background. Falling back to static.", error);
            if(canvas) canvas.style.display = 'none';
            is3DInitialized = false;
        }
    } else {
        console.log("3D background is disabled or elements not found.");
    }
}

export function destroy() {
    if (homeContainer) {
        homeContainer.removeEventListener('mousemove', handleMouseMove);
    }
    const contentArea = document.querySelector('.home-content');
     if (contentArea) {
        contentArea.removeEventListener('click', handleGridClick);
    }
    
    // Clean up card event listeners
    cardEventListeners.forEach(listener => {
        listener.element.removeEventListener(listener.type, listener.handler);
    });
    cardEventListeners = [];

    if (is3DInitialized) {
        console.log("Destroying 3D background from Home module.");
        const canvas = document.getElementById('bg-canvas');
        if(canvas) canvas.classList.remove('visible');
        
        threeManager.destroy();
        is3DInitialized = false;
    }
    appStateRef = null;
    console.log("Home module destroyed.");
}