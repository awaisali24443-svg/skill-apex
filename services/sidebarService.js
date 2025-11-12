import { ROUTES, FEATURES } from '../constants.js';

function createNavLink(route) {
    return `
        <a href="#${route.path}" class="sidebar-link" data-path="${route.path}">
            <svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <use href="/assets/icons/feather-sprite.svg#${route.icon}"/>
            </svg>
            <span class="text">${route.name}</span>
        </a>
    `;
}

export function renderSidebar(container) {
    const mainLinks = ROUTES.filter(r => r.nav && !r.footer);
    const footerLinks = ROUTES.filter(r => r.nav && r.footer);
    
    // Filter based on feature flags
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
