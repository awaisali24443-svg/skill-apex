
import { ROUTES, FEATURES } from '../constants.js';
import * as firebaseService from './firebaseService.js';

// Global listener to update sidebar elements when profile changes
window.addEventListener('profile-updated', () => {
    const container = document.querySelector('.profile-avatar-container');
    const nameText = document.querySelector('.sidebar-profile-header .profile-name');
    
    if (container) {
        const photoURL = firebaseService.getUserPhoto();
        const userName = firebaseService.getUserName();
        container.innerHTML = generateAvatarHTML(photoURL, userName);
    }
    
    if (nameText) {
        nameText.textContent = firebaseService.getUserName();
    }
});

/**
 * Generates HTML for the avatar. 
 */
function generateAvatarHTML(photoURL, name) {
    if (photoURL) {
        return `<img src="${photoURL}" alt="Profile" class="profile-avatar-img">`;
    }
    
    // Generate a consistent color based on name
    let hash = 0;
    const str = name || 'Agent';
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    const color1 = `hsl(${hue}, 70%, 60%)`;
    const color2 = `hsl(${(hue + 40) % 360}, 70%, 40%)`;
    
    const initials = str.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    return `
        <div class="profile-avatar-svg" style="background: linear-gradient(135deg, ${color1}, ${color2}); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
            <span style="color: white; font-weight: 700; font-size: 1.1em; font-family: var(--font-family-heading); text-shadow: 0 1px 2px rgba(0,0,0,0.3);">${initials}</span>
        </div>
    `;
}

/**
 * Creates the HTML for a single navigation link.
 * Uses absolute path for icons to ensure they load from any route depth.
 */
function createNavLink(route) {
    return `
        <a href="#${route.path}" class="sidebar-link" data-path="${route.path}" aria-label="${route.name}">
            <div class="link-icon-wrapper">
                <svg class="icon"><use href="/assets/icons/feather-sprite.svg#${route.icon}"/></svg>
            </div>
            <span class="text">${route.name}</span>
        </a>
    `;
}

/**
 * Renders the Floating Glass Sidebar.
 */
export function renderSidebar(container) {
    if (!container) return;
    
    container.setAttribute('aria-label', 'Main Navigation');

    const mainLinks = ROUTES.filter(r => r.nav && !r.footer);
    const settingsLink = ROUTES.find(r => r.module === 'settings');
    
    // Filter links (e.g., Aural mode check)
    const filteredMainLinks = mainLinks.filter(r => {
        if (r.module === 'aural' && !FEATURES.AURAL_MODE) return false;
        return true;
    });

    const displayName = firebaseService.getUserName();
    const photoURL = firebaseService.getUserPhoto();
    
    const avatarHTML = generateAvatarHTML(photoURL, displayName);

    const html = `
        <!-- Top: Brand Logo (Code Based) -->
        <a href="#/" class="sidebar-brand-section" aria-label="Skill Apex Home">
            <div class="logo-container-sidebar">
                <svg class="logo-svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="logoGradSidebar" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="#4338CA"/> <!-- Indigo -->
                            <stop offset="100%" stop-color="#7C3AED"/> <!-- Violet -->
                        </linearGradient>
                    </defs>
                    <path class="logo-path-stroke" d="M50 5 L95 27.5 V72.5 L50 95 L5 72.5 V27.5 Z" stroke="url(#logoGradSidebar)" stroke-width="4" stroke-linecap="round" fill="none" />
                    <path class="logo-path-fill" d="M50 25 L75 80 H65 L50 45 L35 80 H25 Z" fill="url(#logoGradSidebar)" />
                    <circle cx="50" cy="55" r="4" fill="white" stroke="url(#logoGradSidebar)" stroke-width="2"/>
                </svg>
            </div>
            <span class="brand-text-sidebar">Skill Apex</span>
        </a>

        <!-- Header: Facenote Style Profile -->
        <div class="sidebar-profile-header">
            <div class="profile-avatar-container">
                ${avatarHTML}
            </div>
            <div class="profile-info-text">
                <span class="profile-name">${displayName}</span>
                <span class="profile-role">My Account</span>
            </div>
            <svg class="icon profile-chevron"><use href="/assets/icons/feather-sprite.svg#chevron-down"/></svg>
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
                    <svg class="icon"><use href="/assets/icons/feather-sprite.svg#power"/></svg>
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
                window.location.reload(); 
            }
        });
    }
}
