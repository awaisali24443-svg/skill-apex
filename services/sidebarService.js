import { ROUTES, FEATURES } from '../constants.js';

/**
 * Creates the HTML for a single navigation link in the sidebar.
 * @param {object} route - The route object from constants.js.
 * @returns {string} The HTML string for the link.
 * @private
 */
function createNavLink(route) {
    return `
        <a href="#${route.path}" class="sidebar-link" data-path="${route.path}" aria-label="${route.name}">
            <svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <use href="/assets/icons/feather-sprite.svg#${route.icon}"/>
            </svg>
            <span class="text">${route.name}</span>
        </a>
    `;
}

/**
 * Renders the entire sidebar content, including navigation links.
 * Filters links based on feature flags.
 * @param {HTMLElement} container - The <nav> element to render the sidebar into.
 */
export function renderSidebar(container) {
    // Add ARIA label for screen readers
    container.setAttribute('aria-label', 'Main Navigation');

    const mainLinks = ROUTES.filter(r => r.nav && !r.footer);
    const footerLinks = ROUTES.filter(r => r.nav && r.footer);
    
    // Filter links based on feature flags for progressive feature rollout.
    const filteredMainLinks = mainLinks.filter(r => {
        if (r.module === 'learning-path-generator' && !FEATURES.LEARNING_PATHS) return false;
        if (r.module === 'aural' && !FEATURES.AURAL_MODE) return false;
        return true;
    });

    const html = `
        <div class="sidebar-logo">KT</div>
        <ul class="sidebar-links">
            ${filteredMainLinks.map(createNavLink).join('')}
        </ul>
        <div style="flex-grow: 1;"></div> <!-- Spacer -->
        <ul class="sidebar-links">
             ${footerLinks.map(createNavLink).join('')}
        </ul>
    `;
    container.innerHTML = html;
}