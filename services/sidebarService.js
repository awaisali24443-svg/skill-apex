
import { ROUTES, FEATURES } from '../constants.js';

/**
 * Creates the HTML for a single navigation link in the sidebar.
 * @param {object} route - The route object from constants.js.
 * @param {number} index - The index of the route, used for coloring.
 * @returns {string} The HTML string for the link.
 * @private
 */
function createNavLink(route, index) {
    // Cycle through 6 distinct colors defined in global.css
    const colorClass = `icon-color-${(index % 6) + 1}`;
    
    return `
        <a href="#${route.path}" class="sidebar-link" data-path="${route.path}" aria-label="${route.name}">
            <svg class="icon ${colorClass}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <use href="assets/icons/feather-sprite.svg#${route.icon}"/>
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
        if (r.module === 'aural' && !FEATURES.AURAL_MODE) return false;
        return true;
    });

    const html = `
        <a href="/#/" class="sidebar-logo" aria-label="Knowledge Tester Home">
            <img src="assets/icons/favicon.svg" alt="Knowledge Tester Logo" class="sidebar-logo-img">
            <span class="sidebar-logo-text">Knowledge Tester</span>
        </a>
        <ul class="sidebar-links">
            ${filteredMainLinks.map((link, i) => createNavLink(link, i)).join('')}
        </ul>
        <div style="flex-grow: 1;"></div> <!-- Spacer -->
        <ul class="sidebar-links">
             ${footerLinks.map((link, i) => createNavLink(link, i + filteredMainLinks.length)).join('')}
        </ul>
    `;
    container.innerHTML = html;
}