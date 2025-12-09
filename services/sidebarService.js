
import { ROUTES, FEATURES } from '../constants.js';
import * as firebaseService from './firebaseService.js';

/**
 * Creates the HTML for a single navigation link.
 */
function createNavLink(route) {
    return `
        <a href="#${route.path}" class="sidebar-link" data-path="${route.path}" aria-label="${route.name}">
            <div class="link-icon-wrapper">
                <svg class="icon"><use href="assets/icons/feather-sprite.svg#${route.icon}"/></svg>
            </div>
            <span class="text">${route.name}</span>
        </a>
    `;
}

/**
 * Renders the Floating Glass Sidebar (Facenote Style).
 */
export function renderSidebar(container) {
    container.setAttribute('aria-label', 'Main Navigation');

    const mainLinks = ROUTES.filter(r => r.nav && !r.footer);
    const settingsLink = ROUTES.find(r => r.module === 'settings');
    
    // Filter links (e.g., Aural mode check)
    const filteredMainLinks = mainLinks.filter(r => {
        if (r.module === 'aural' && !FEATURES.AURAL_MODE) return false;
        return true;
    });

    const userEmail = firebaseService.getUserEmail() || 'Guest';
    const userName = userEmail.split('@')[0];
    const isGuest = firebaseService.isGuest();

    const html = `
        <!-- Top: Window Controls -->
        <div class="window-controls">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
        </div>

        <!-- Header: Facenote Style Profile -->
        <div class="sidebar-profile-header">
            <div class="profile-avatar-container">
                <img src="assets/images/avatar-placeholder.png" alt="Profile" class="profile-avatar-img">
            </div>
            <div class="profile-info-text">
                <span class="profile-name">${userName}</span>
                <span class="profile-role">My Account</span>
            </div>
            <svg class="icon profile-chevron"><use href="assets/icons/feather-sprite.svg#chevron-down"/></svg>
        </div>

        <div class="sidebar-divider"></div>

        <!-- Menu -->
        <div class="sidebar-menu-label">MENU</div>
        <ul class="sidebar-links">
            ${filteredMainLinks.map(link => createNavLink(link)).join('')}
        </ul>

        <div class="sidebar-spacer"></div>

        <!-- Bottom Actions -->
        <ul class="sidebar-links footer-links">
            ${settingsLink ? createNavLink(settingsLink) : ''}
            <button id="sidebar-logout-btn" class="sidebar-link logout-link">
                <div class="link-icon-wrapper">
                    <svg class="icon"><use href="assets/icons/feather-sprite.svg#power"/></svg>
                </div>
                <span class="text">Log Out</span>
            </button>
        </ul>
    `;
    
    container.innerHTML = html;

    // Attach Logout Listener
    const logoutBtn = document.getElementById('sidebar-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const { showConfirmationModal } = await import('./modalService.js');
            const confirmed = await showConfirmationModal({
                title: 'Log Out',
                message: 'Are you sure you want to sign out?',
                confirmText: 'Log Out',
                danger: true
            });
            if (confirmed) {
                firebaseService.logout();
            }
        });
    }
}
