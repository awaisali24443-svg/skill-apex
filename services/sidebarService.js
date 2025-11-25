
import { ROUTES, FEATURES } from '../constants.js';
import * as voiceCommandService from './voiceCommandService.js';

function createNavLink(route, index) {
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

export function renderSidebar(container) {
    container.setAttribute('aria-label', 'Main Navigation');

    const mainLinks = ROUTES.filter(r => r.nav && !r.footer);
    const footerLinks = ROUTES.filter(r => r.nav && r.footer);
    
    const filteredMainLinks = mainLinks.filter(r => {
        if (r.module === 'aural' && !FEATURES.AURAL_MODE) return false;
        return true;
    });

    const html = `
        <a href="/#/" class="sidebar-logo" aria-label="Knowledge Tester Home">
            <img src="assets/icons/feather-sprite.svg" alt="Knowledge Tester Logo" class="sidebar-logo-img">
            <span class="sidebar-logo-text">Knowledge Tester</span>
        </a>
        <ul class="sidebar-links">
            ${filteredMainLinks.map((link, i) => createNavLink(link, i)).join('')}
        </ul>
        <div style="flex-grow: 1;"></div>
        
        <!-- VOICE NAV BUTTON -->
        <button id="voice-nav-toggle" class="sidebar-link" aria-label="Toggle Voice Navigation" style="background:transparent; border:none; width:100%; cursor:pointer;">
            <svg class="icon" width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" style="color:var(--color-secondary);">
                <use href="assets/icons/feather-sprite.svg#mic"/>
            </svg>
            <span class="text">Voice Nav</span>
        </button>

        <!-- HELP BUTTON -->
        <button id="global-help-btn" class="sidebar-link" aria-label="Help" style="background:transparent; border:none; width:100%; cursor:pointer;">
            <svg class="icon" width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" style="color:var(--color-text-secondary);">
                <use href="assets/icons/feather-sprite.svg#circle"/>
            </svg>
            <span class="text">Help</span>
        </button>

        <ul class="sidebar-links">
             ${footerLinks.map((link, i) => createNavLink(link, i + filteredMainLinks.length)).join('')}
        </ul>
    `;
    container.innerHTML = html;

    // Attach Listeners
    setTimeout(() => {
        const helpBtn = document.getElementById('global-help-btn');
        if(helpBtn) {
            helpBtn.addEventListener('click', () => {
                const modal = document.getElementById('help-modal');
                if(modal) modal.style.display = 'flex';
            });
        }

        const voiceBtn = document.getElementById('voice-nav-toggle');
        if(voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                voiceCommandService.toggleListening();
            });
        }
    }, 0);
}
