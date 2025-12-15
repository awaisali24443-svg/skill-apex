
import * as gamificationService from '../../services/gamificationService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';
import * as vfxService from '../../services/vfxService.js';

let elements = {};

function renderProfile() {
    const stats = gamificationService.getStats();
    const displayName = firebaseService.getUserName() || 'Agent';
    const photoURL = firebaseService.getUserPhoto();
    const userId = firebaseService.getUserId() || 'GUEST';

    // 1. Identity
    elements.nameDisplay.textContent = displayName;
    elements.nameInput.value = displayName;
    elements.emailText.textContent = firebaseService.getUserEmail() || 'Guest Mode';
    
    // RENDER AVATAR (NO IMG unless user uploaded)
    elements.avatarDisplay.innerHTML = '';
    if (photoURL) {
        const img = document.createElement('img');
        img.src = photoURL;
        img.alt = 'Avatar';
        img.className = 'profile-avatar-img';
        elements.avatarDisplay.appendChild(img);
    } else {
        const initials = displayName.substring(0, 2).toUpperCase();
        elements.avatarDisplay.innerHTML = `
            <svg viewBox="0 0 100 100" class="profile-avatar-svg">
                <rect width="100" height="100" fill="var(--color-surface-hover)"/>
                <text x="50" y="65" text-anchor="middle" fill="var(--color-primary)" font-size="40" font-weight="bold" font-family="var(--font-family-heading)">${initials}</text>
            </svg>
        `;
    }
    
    // 2. Recruitment Link - UPDATED DOMAIN
    const shortId = userId.substring(0, 6).toUpperCase();
    elements.recruiterInput.value = `https://skill-apex.onrender.com/join/${shortId}`;

    // 3. Circle Progress
    const xpCurrent = stats.xp;
    const xpNext = gamificationService.getXpForNextLevel(stats.level);
    const percent = Math.min(100, Math.round((xpCurrent / xpNext) * 100)) || 0;
    
    elements.progressPercent.textContent = `${percent}%`;
    setTimeout(() => {
        if(elements.progressCircle) elements.progressCircle.setAttribute('stroke-dasharray', `${percent}, 100`);
    }, 100);

    // 4. Populate Stats Strip (Animated)
    if(elements.statStreak) vfxService.animateNumber(elements.statStreak, 0, stats.currentStreak, 1000);
    if(elements.statXp) vfxService.animateNumber(elements.statXp, 0, stats.xp, 1500);
    if(elements.statQuizzes) vfxService.animateNumber(elements.statQuizzes, 0, stats.totalQuizzesCompleted, 1000);

    renderAchievements(stats);
}

function renderAchievements(stats) {
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = '';

    const achievements = gamificationService.getAchievementsProgress();

    achievements.forEach(ach => {
        const card = document.createElement('div');
        card.className = `achievement-card ${ach.isUnlocked ? 'unlocked' : 'locked'}`;
        
        let progressHtml = '';
        
        if (ach.isMaxed) {
            progressHtml = `
                <div class="ach-progress-bar"><div class="ach-progress-fill" style="width:100%; background:var(--color-success)"></div></div>
                <span class="ach-meta" style="color:var(--color-success)">MAX TIER</span>
            `;
        } else {
            progressHtml = `
                <div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${ach.progressPercent}%"></div></div>
                <span class="ach-meta">${ach.currentValue} / ${ach.target}</span>
            `;
        }

        card.innerHTML = `
            <div class="achievement-icon-wrapper">
                <svg class="icon"><use href="assets/icons/achievements.svg#${ach.icon}"/></svg>
            </div>
            <h4 class="ach-title">${ach.name}</h4>
            <p class="ach-desc">${ach.description}</p>
            ${progressHtml}
        `;
        grid.appendChild(card);
    });
}

// --- Interaction Handlers ---

function toggleNameEdit() {
    const isEditing = elements.nameDisplay.style.display === 'none';
    
    if (isEditing) {
        // Close
        elements.nameDisplay.parentNode.style.display = 'flex';
        elements.editNameWrapper.style.display = 'none';
    } else {
        // Open
        elements.nameDisplay.parentNode.style.display = 'none';
        elements.editNameWrapper.style.display = 'flex';
        elements.nameInput.focus();
    }
}

async function saveName() {
    const newName = elements.nameInput.value.trim();
    if (!newName) return;
    
    const btn = document.getElementById('save-name-btn');
    btn.disabled = true;

    try {
        await firebaseService.updateUserProfile({ displayName: newName });
        elements.nameDisplay.textContent = newName;
        showToast('Codename updated.', 'success');
        toggleNameEdit();
        renderProfile(); // Re-render to update avatar initials
    } catch (e) {
        showToast('Update failed.', 'error');
    } finally {
        btn.disabled = false;
    }
}

function handleFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) {
        showToast('Image file required.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        // We only allow IMG tags for USER UPLOADED content
        elements.avatarDisplay.innerHTML = '';
        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'profile-avatar-img';
        elements.avatarDisplay.appendChild(img);
        
        firebaseService.updateUserProfile({ photoURL: e.target.result })
            .then(() => showToast('Avatar updated.', 'success'))
            .catch(() => showToast('Upload failed.', 'error'));
    };
    reader.readAsDataURL(file);
}

function setupDragDrop() {
    const zone = document.getElementById('avatar-drop-zone');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    zone.addEventListener('dragenter', () => zone.querySelector('.avatar-ring').style.transform = 'scale(1.1)');
    zone.addEventListener('dragleave', () => zone.querySelector('.avatar-ring').style.transform = 'scale(1)');
    
    zone.addEventListener('drop', (e) => {
        zone.querySelector('.avatar-ring').style.transform = 'scale(1)';
        const dt = e.dataTransfer;
        handleFileSelect(dt.files[0]);
    });
    
    zone.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
}

export function init() {
    elements = {
        nameDisplay: document.getElementById('user-name-display'),
        editNameWrapper: document.getElementById('edit-name-wrapper'),
        nameInput: document.getElementById('user-name-input'),
        editBtn: document.getElementById('edit-profile-btn'),
        saveNameBtn: document.getElementById('save-name-btn'),
        emailText: document.getElementById('user-email-text'),
        avatarDisplay: document.getElementById('profile-avatar-display'),
        fileInput: document.getElementById('avatar-upload'),
        recruiterInput: document.getElementById('recruiter-id-input'),
        progressPercent: document.getElementById('progress-percent'),
        progressCircle: document.getElementById('progress-circle-path'),
        copyBtn: document.getElementById('copy-ref-btn'),
        
        // New Stats
        statStreak: document.getElementById('stat-streak'),
        statXp: document.getElementById('stat-xp'),
        statQuizzes: document.getElementById('stat-quizzes'),
    };
    
    renderProfile();
    setupDragDrop();
    
    elements.editBtn.addEventListener('click', toggleNameEdit);
    elements.saveNameBtn.addEventListener('click', saveName);
    
    elements.copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(elements.recruiterInput.value);
        showToast('Link copied.', 'success');
    });
}

export function destroy() {}
