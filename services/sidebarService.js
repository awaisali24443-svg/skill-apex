
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
 */
function createNavLink(route, extraClass = '') {
    return `
        <a href="#${route.path}" class="sidebar-link ${extraClass}" data-path="${route.path}" aria-label="${route.name}">
            <div class="link-icon-wrapper">
                <svg class="icon"><use href="assets/icons/feather-sprite.svg#${route.icon}"/></svg>
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
        <!-- Top: Brand Logo (Left Aligned on Expand) -->
        <a href="#/" class="sidebar-brand-section" aria-label="Skill Apex Home">
            <div class="logo-container-sidebar">
                <!-- Simple "F" style letter or Icon -->
                <span>SA</span>
            </div>
            <span class="brand-text-sidebar">Skill Apex</span>
        </a>

        <!-- Profile Card (Glass Style) -->
        <div class="sidebar-profile-header">
            <div class="profile-avatar-container">
                ${avatarHTML}
            </div>
            <div class="profile-info-text">
                <span class="profile-name">${displayName}</span>
                <span class="profile-role">My Account</span>
            </div>
            <svg class="icon profile-chevron"><use href="assets/icons/feather-sprite.svg#chevron-down"/></svg>
        </div>

        <!-- Menu Label -->
        <div class="sidebar-menu-label">MENU</div>
        
        <!-- Combined Navigation Links Container -->
        <nav class="sidebar-links">
            ${filteredMainLinks.map(link => createNavLink(link)).join('')}
            
            <!-- Adaptive Spacer: Grows on Desktop, Hides on Mobile -->
            <div class="sidebar-spacer adaptive-spacer"></div>
            
            <!-- Settings Link: Part of flow on Mobile, Pushed down on Desktop -->
            ${settingsLink ? createNavLink(settingsLink, 'settings-link') : ''}
            
            <!-- Logout: Desktop Only Button (Mobile uses Settings page) -->
            <button id="sidebar-logout-btn" class="sidebar-link logout-link desktop-only">
                <div class="link-icon-wrapper">
                    <svg class="icon"><use href="assets/icons/feather-sprite.svg#power"/></svg>
                </div>
                <span class="text">Log Out</span>
            </button>
        </nav>
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
