import * as gamificationService from '../../services/gamificationService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';
import * as vfxService from '../../services/vfxService.js';

let elements = {};

function generateAvatarHTML(photoURL, name) {
    if (photoURL) return `<img src="${photoURL}" alt="Profile" class="avatar-img">`;
    let hash = 0;
    const str = name || 'Agent';
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash % 360);
    const color1 = `hsl(${hue}, 70%, 60%)`;
    const color2 = `hsl(${(hue + 40) % 360}, 70%, 40%)`;
    const initials = str.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return `<div class="avatar-svg-generated" style="background: linear-gradient(135deg, ${color1}, ${color2}); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white;"><span style="font-weight: 800; font-size: 2.5rem; font-family: var(--font-family-heading); text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${initials}</span></div>`;
}

function renderProfile() {
    const stats = gamificationService.getStats();
    const displayName = firebaseService.getUserName() || 'Agent';
    const photoURL = firebaseService.getUserPhoto();
    const email = firebaseService.getUserEmail();

    if (elements.nameDisplay) elements.nameDisplay.textContent = displayName;
    if (elements.nameInput) elements.nameInput.value = displayName;
    if (elements.emailText) elements.emailText.textContent = email || 'Guest Mode';
    if (elements.avatarContainer) elements.avatarContainer.innerHTML = generateAvatarHTML(photoURL, displayName);
    
    if (elements.recruiterInput) {
        const shortId = (firebaseService.getUserId() || 'GUEST').substring(0, 6).toUpperCase();
        elements.recruiterInput.value = `https://skill-apex.onrender.com/join/${shortId}`;
    }

    const xpCurrent = stats.xp;
    const xpNext = gamificationService.getXpForNextLevel(stats.level);
    const percent = Math.min(100, Math.round((xpCurrent / xpNext) * 100)) || 0;
    
    if (elements.progressPercent) elements.progressPercent.textContent = `${percent}%`;
    setTimeout(() => { if(elements.progressCircle) elements.progressCircle.setAttribute('stroke-dasharray', `${percent}, 100`); }, 100);

    if(elements.statStreak) vfxService.animateNumber(elements.statStreak, 0, stats.currentStreak, 1000);
    if(elements.statXp) vfxService.animateNumber(elements.statXp, 0, stats.xp, 1500);
    if(elements.statQuizzes) vfxService.animateNumber(elements.statQuizzes, 0, stats.totalQuizzesCompleted, 1000);

    updateBadges(email);
    renderAchievements(stats);
}

function updateBadges(email) {
    const badgeContainer = document.querySelector('.level-badge-row');
    if (!badgeContainer) return;
    let badgesHTML = (email === 'admin.expo@skillapex.com') ? '<div class="status-pill red">System Admin</div><div class="status-pill gold">Elite</div>' : '<div class="status-pill blue">Learner</div>';
    if (gamificationService.getStats().level > 10) badgesHTML += '<div class="status-pill purple">Advanced</div>';
    badgeContainer.innerHTML = badgesHTML;
}

function renderAchievements(stats) {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const achievements = gamificationService.getAchievementsProgress();
    achievements.forEach(ach => {
        const card = document.createElement('div');
        card.className = `achievement-card ${ach.isUnlocked ? 'unlocked' : 'locked'}`;
        const progressHtml = ach.isMaxed ? '<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:100%; background:var(--color-success)"></div></div><span class="ach-meta" style="color:var(--color-success)">MAX TIER</span>' : `<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${ach.progressPercent}%"></div></div><span class="ach-meta">${ach.currentValue} / ${ach.target}</span>`;
        card.innerHTML = `<div class="achievement-icon-wrapper"><svg class="icon"><use href="#ach-${ach.icon}"/></svg></div><h4 class="ach-title">${ach.name}</h4><p class="ach-desc">${ach.description}</p>${progressHtml}`;
        grid.appendChild(card);
    });
}

export function init() {
    elements = {
        nameDisplay: document.getElementById('user-name-display'), editNameWrapper: document.getElementById('edit-name-wrapper'), nameInput: document.getElementById('user-name-input'), editBtn: document.getElementById('edit-profile-btn'), saveNameBtn: document.getElementById('save-name-btn'), emailText: document.getElementById('user-email-text'), avatarContainer: document.getElementById('profile-avatar-container'), fileInput: document.getElementById('avatar-upload'), recruiterInput: document.getElementById('recruiter-id-input'), progressPercent: document.getElementById('progress-percent'), progressCircle: document.getElementById('progress-circle-path'), copyBtn: document.getElementById('copy-ref-btn'), statStreak: document.getElementById('stat-streak'), statXp: document.getElementById('stat-xp'), statQuizzes: document.getElementById('stat-quizzes')
    };
    renderProfile();
    if (elements.editBtn) elements.editBtn.onclick = () => { elements.nameDisplay.parentNode.style.display = 'none'; elements.editNameWrapper.style.display = 'flex'; elements.nameInput.focus(); };
    if (elements.saveNameBtn) elements.saveNameBtn.onclick = async () => {
        const newName = elements.nameInput.value.trim();
        if (!newName) return;
        await firebaseService.updateUserProfile({ displayName: newName });
        window.location.reload();
    };
    if (elements.copyBtn) elements.copyBtn.onclick = () => { navigator.clipboard.writeText(elements.recruiterInput.value); showToast('Link copied.', 'success'); };
}

export function destroy() {}
