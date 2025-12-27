
import { ROUTES, FEATURES } from '../constants.js';
import * as firebaseService from './firebaseService.js';

function generateAvatarHTML(photoURL, name) {
    if (photoURL) return `<img src="${photoURL}" alt="Profile" class="profile-avatar-img">`;
    let hash = 0; const str = name || 'Agent';
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash % 360);
    const initials = str.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return `<div class="profile-avatar-svg" style="background: linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${(hue + 40) % 360}, 70%, 40%)); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;"><span style="color: white; font-weight: 700;">${initials}</span></div>`;
}

function createNavLink(route, extraClass = '') {
    const isActive = window.location.pathname === route.path;
    return `
        <a href="${route.path}" class="sidebar-link ${extraClass} ${isActive ? 'active' : ''}" aria-label="${route.name}">
            <div class="link-icon-wrapper">
                <svg class="icon"><use href="/assets/icons/feather-sprite.svg#${route.icon}"/></svg>
            </div>
            <span class="text">${route.name}</span>
        </a>
    `;
}

export function renderSidebar(container) {
    if (!container) return;
    const mainLinks = ROUTES.filter(r => r.nav && !r.footer);
    const settingsLink = ROUTES.find(r => r.module === 'settings');
    const filteredMainLinks = mainLinks.filter(r => r.module !== 'aural' || FEATURES.AURAL_MODE);
    const displayName = firebaseService.getUserName();
    const avatarHTML = generateAvatarHTML(firebaseService.getUserPhoto(), displayName);

    container.innerHTML = `
        <div class="sidebar-inner">
            <div class="sidebar-profile-header">
                <div class="profile-avatar-container">${avatarHTML}</div>
                <div class="profile-info-text"><span class="profile-name">${displayName}</span><span class="profile-role">Operative</span></div>
            </div>
            <div class="sidebar-divider"></div>
            <div class="sidebar-menu-label">SYSTEM</div>
            <nav class="sidebar-links">
                ${filteredMainLinks.map(link => createNavLink(link)).join('')}
            </nav>
            <div class="sidebar-footer">
                ${settingsLink ? createNavLink(settingsLink, 'settings-link') : ''}
                <button id="sidebar-logout-btn" class="sidebar-link logout-link">
                    <div class="link-icon-wrapper"><svg class="icon"><use href="/assets/icons/feather-sprite.svg#power"/></svg></div>
                    <span class="text">Exit</span>
                </button>
            </div>
        </div>
    `;

    document.getElementById('sidebar-logout-btn').onclick = async () => {
        const { showConfirmationModal } = await import('./modalService.js');
        if (await showConfirmationModal({ title: 'Log Out', message: 'End session?', danger: true })) {
            await firebaseService.logout();
            window.location.href = '/';
        }
    };
}
