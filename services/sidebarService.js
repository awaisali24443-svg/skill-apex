
import { ROUTES, FEATURES } from '../constants.js';
import * as firebaseService from './firebaseService.js';

// Global listener to update sidebar elements when profile changes (e.g. from Profile module)
window.addEventListener('profile-updated', () => {
    const img = document.querySelector('.sidebar-profile-header .profile-avatar-img');
    const nameText = document.querySelector('.sidebar-profile-header .profile-name');
    
    if (img) {
        const photoURL = firebaseService.getUserPhoto();
        if (photoURL) {
            img.src = photoURL;
        }
    }
    
    if (nameText) {
        nameText.textContent = firebaseService.getUserName();
    }
});

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
    // Use getUserName for display name logic which handles display name > email split > default
    const displayName = firebaseService.getUserName();
    const photoURL = firebaseService.getUserPhoto() || 'assets/images/avatar-placeholder.png';
    const isGuest = firebaseService.isGuest();

    const html = `
        <!-- Top: Brand Logo (Code Based) -->
        <a href="#/" class="sidebar-brand-section" aria-label="Skill Apex Home">
            <div class="logo-container-sidebar">
                <svg class="logo-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="logoGradSidebar" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="var(--color-primary)"/>
                            <stop offset="100%" stop-color="var(--color-secondary)"/>
                        </linearGradient>
                    </defs>
                    <path d="M50 5 L95 27.5 V72.5 L50 95 L5 72.5 V27.5 Z" stroke="url(#logoGradSidebar)" stroke-width="4" stroke-linecap="round" fill="none" />
                    <path d="M50 25 L75 80 H65 L50 45 L35 80 H25 Z" fill="url(#logoGradSidebar)" />
                    <circle cx="50" cy="55" r="4" fill="var(--color-background)" stroke="var(--color-primary)" stroke-width="2"/>
                </svg>
            </div>
            <span class="brand-text-sidebar">Skill Apex</span>
        </a>

        <!-- Header: Facenote Style Profile -->
        <div class="sidebar-profile-header">
            <div class="profile-avatar-container">
                <img src="${photoURL}" alt="Profile" class="profile-avatar-img">
            </div>
            <div class="profile-info-text">
                <span class="profile-name">${displayName}</span>
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
        
        <!-- AUTHORSHIP CREDIT -->
        <div class="sidebar-credit" style="padding: 10px 16px 0; margin-top: 10px; font-size: 0.65rem; color: var(--color-text-secondary); text-align: center; border-top: 1px solid rgba(255,255,255,0.05); opacity:0.8;">
            <span class="text" style="display:block;">Architect: <span style="color:var(--color-primary); font-weight:700;">Awais Ali</span></span>
        </div>
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
                await firebaseService.logout();
                window.location.reload(); // Critical Fix: Force reload to clear all SPA state
            }
        });
    }
}
