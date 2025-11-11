import { isFeatureEnabled } from '../../services/featureService.js';
import { getCategories } from '../../services/topicService.js';

let appStateRef;

// --- UI Rendering ---

const dashboardItems = [
    {
        href: '#library',
        icon: '📚',
        title: 'My Library',
        description: 'Review your saved questions and prepare for tests.',
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

const handleHeroFormSubmit = (e) => {
    e.preventDefault();
    const input = document.getElementById('hero-topic-input');
    const topic = input.value.trim();
    if (topic && appStateRef) {
        appStateRef.context = { topic };
        window.location.hash = '#loading';
    } else {
        input.focus();
    }
};

function renderActionCards() {
    const gridContainer = document.getElementById('dashboard-grid');
    if (!gridContainer) return;

    const cardsHtml = dashboardItems.map(item => {
        const isEnabled = !item.feature || isFeatureEnabled(item.feature);
        const isComingSoon = item.feature === 'learningPaths' && !isEnabled;

        if (!isEnabled && !isComingSoon) return '';

        const tag = isComingSoon ? 'div' : 'a';
        const href = isComingSoon ? '' : `href="${item.href}"`;
        const extraClasses = isComingSoon ? 'coming-soon' : '';

        return `
            <${tag} ${href} class="dashboard-card ${extraClasses}">
                 <div class="card-icon">${item.icon}</div>
                 <div class="card-content">
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                    ${isComingSoon ? `<div class="card-footer"><span class="coming-soon-tag">Coming Soon</span></div>` : ''}
                </div>
            </${tag}>
        `;
    }).join('');
    gridContainer.innerHTML = cardsHtml;
}

async function renderTopicCategories() {
    const carouselContainer = document.getElementById('category-carousel-container');
    if (!carouselContainer) return;

    try {
        const categories = await getCategories();
        if (categories.length > 0) {
            const categoriesHtml = categories.map(cat => `
                <a href="#topics/${cat.id}" class="category-card">
                    <div class="category-card-icon">${cat.icon}</div>
                    <h3>${cat.name}</h3>
                    <p>${cat.description}</p>
                    <div class="category-card-footer">Explore →</div>
                </a>
            `).join('');
            carouselContainer.innerHTML = categoriesHtml;
        } else {
            carouselContainer.innerHTML = `<p>No curated topics available right now.</p>`;
        }
    } catch (error) {
        console.error("Could not load topic categories for home screen", error);
        carouselContainer.innerHTML = '<p>Error loading topics. Please try refreshing the page.</p>';
    }
}

// --- Module Lifecycle ---

export async function init(appState) {
    console.log("Home module initialized.");
    appStateRef = appState;
    
    const heroForm = document.getElementById('hero-quiz-form');
    if (heroForm) {
        heroForm.addEventListener('submit', handleHeroFormSubmit);
    }
    
    renderActionCards();
    await renderTopicCategories();
    
    const allCards = document.querySelectorAll('.dashboard-card');
    allCards.forEach((card, index) => {
        // Stagger the animation for a nice effect
        card.style.animationDelay = `${index * 100}ms`;
    });
}

export function destroy() {
    const heroForm = document.getElementById('hero-quiz-form');
    if (heroForm) {
        heroForm.removeEventListener('submit', handleHeroFormSubmit);
    }
    appStateRef = null;
    console.log("Home module destroyed.");
}