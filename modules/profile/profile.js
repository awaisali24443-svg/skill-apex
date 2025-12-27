
import * as gamificationService from '../../services/gamificationService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';
import * as vfxService from '../../services/vfxService.js';

let elements = {};

function generateAvatarHTML(photoURL, name) {
    if (photoURL) {
        return `<img src="${photoURL}" alt="Profile" class="avatar-img">`;
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
    
    // Get initials (max 2 chars)
    const initials = str.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    return `
        <div class="avatar-svg-generated" style="background: linear-gradient(135deg, ${color1}, ${color2}); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white;">
            <span style="font-weight: 800; font-size: 2.5rem; font-family: var(--font-family-heading); text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${initials}</span>
        </div>
    `;
}

function renderProfile() {
    const stats = gamificationService.getStats();
    const displayName = firebaseService.getUserName() || 'Agent';
    const photoURL = firebaseService.getUserPhoto();
    const userId = firebaseService.getUserId() || 'GUEST';
    const email = firebaseService.getUserEmail();

    // 1. Identity
    if (elements.nameDisplay) elements.nameDisplay.textContent = displayName;
    if (elements.nameInput) elements.nameInput.value = displayName;
    if (elements.emailText) elements.emailText.textContent = email || 'Guest Mode';
    
    // 2. Avatar (Code Based)
    if (elements.avatarContainer) {
        elements.avatarContainer.innerHTML = generateAvatarHTML(photoURL, displayName);
    }
    
    // 3. Recruitment Link
    if (elements.recruiterInput) {
        const shortId = userId.substring(0, 6).toUpperCase();
        elements.recruiterInput.value = `https://skill-apex.onrender.com/join/${shortId}`;
    }

    // 4. Circle Progress
    const xpCurrent = stats.xp;
    const xpNext = gamificationService.getXpForNextLevel(stats.level);
    const percent = Math.min(100, Math.round((xpCurrent / xpNext) * 100)) || 0;
    
    if (elements.progressPercent) elements.progressPercent.textContent = `${percent}%`;
    setTimeout(() => {
        if(elements.progressCircle) elements.progressCircle.setAttribute('stroke-dasharray', `${percent}, 100`);
    }, 100);

    // 5. Populate Stats Strip (Animated)
    if(elements.statStreak) vfxService.animateNumber(elements.statStreak, 0, stats.currentStreak, 1000);
    if(elements.statXp) vfxService.animateNumber(elements.statXp, 0, stats.xp, 1500);
    if(elements.statQuizzes) vfxService.animateNumber(elements.statQuizzes, 0, stats.totalQuizzesCompleted, 1000);

    // 6. Dynamic Badges
    updateBadges(email);

    renderAchievements(stats);
}

function updateBadges(email) {
    const badgeContainer = document.querySelector('.level-badge-row');
    if (!badgeContainer) return;

    let badgesHTML = '';

    // Admin Check
    if (email === 'admin.expo@skillapex.com') {
        badgesHTML += `<div class="status-pill red">System Admin</div>`;
        badgesHTML += `<div class="status-pill gold">Elite</div>`;
    } else {
        badgesHTML += `<div class="status-pill blue">Learner</div>`;
        if (gamificationService.getStats().level > 10) {
            badgesHTML += `<div class="status-pill purple">Advanced</div>`;
        } else {
            badgesHTML += `<div class="status-pill purple">Beta User</div>`;
        }
    }

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
        // Refresh avatar to update initials
        const photoURL = firebaseService.getUserPhoto();
        elements.avatarContainer.innerHTML = generateAvatarHTML(photoURL, newName);
        showToast('Codename updated.', 'success');
        toggleNameEdit();
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
        const result = e.target.result;
        // Optimistic UI update
        elements.avatarContainer.innerHTML = generateAvatarHTML(result, elements.nameDisplay.textContent);
        
        firebaseService.updateUserProfile({ photoURL: result })
            .then(() => showToast('Avatar updated.', 'success'))
            .catch(() => showToast('Upload failed.', 'error'));
    };
    reader.readAsDataURL(file);
}

function setupDragDrop() {
    const zone = document.getElementById('avatar-drop-zone');
    if (!zone) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    zone.addEventListener('dragenter', () => zone.querySelector('.avatar-ring').style.transform = 'scale(1.05)');
    zone.addEventListener('dragleave', () => zone.querySelector('.avatar-ring').style.transform = 'scale(1)');
    
    zone.addEventListener('drop', (e) => {
        zone.querySelector('.avatar-ring').style.transform = 'scale(1)';
        const dt = e.dataTransfer;
        handleFileSelect(dt.files[0]);
    });
    
    // Wire up the click to the HIDDEN file input
    zone.addEventListener('click', () => {
        if(elements.fileInput) elements.fileInput.click();
    });
    
    if (elements.fileInput) {
        elements.fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
    }
}

export function init() {
    elements = {
        nameDisplay: document.getElementById('user-name-display'),
        editNameWrapper: document.getElementById('edit-name-wrapper'),
        nameInput: document.getElementById('user-name-input'),
        editBtn: document.getElementById('edit-profile-btn'),
        saveNameBtn: document.getElementById('save-name-btn'),
        emailText: document.getElementById('user-email-text'),
        avatarContainer: document.getElementById('profile-avatar-container'),
        fileInput: document.getElementById('avatar-upload'),
        recruiterInput: document.getElementById('recruiter-id-input'),
        progressPercent: document.getElementById('progress-percent'),
        progressCircle: document.getElementById('progress-circle-path'),
        copyBtn: document.getElementById('copy-ref-btn'),
        shareProfileBtn: document.getElementById('share-profile-btn'),
        
        statStreak: document.getElementById('stat-streak'),
        statXp: document.getElementById('stat-xp'),
        statQuizzes: document.getElementById('stat-quizzes'),
    };
    
    renderProfile();
    setupDragDrop();
    
    if (elements.editBtn) elements.editBtn.addEventListener('click', toggleNameEdit);
    if (elements.saveNameBtn) elements.saveNameBtn.addEventListener('click', saveName);
    
    if (elements.copyBtn) elements.copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(elements.recruiterInput.value);
        showToast('Link copied.', 'success');
    });

    if (elements.shareProfileBtn) {
        elements.shareProfileBtn.addEventListener('click', async () => {
            if (navigator.share) {
                try {
                    const name = elements.nameDisplay.textContent;
                    await navigator.share({
                        title: `${name}'s Skill Apex Profile`,
                        text: `Check out my stats on Skill Apex! I've completed ${elements.statQuizzes.textContent} quizzes.`,
                        url: elements.recruiterInput.value
                    });
                } catch(e) { console.log("Share skipped"); }
            } else {
                navigator.clipboard.writeText(elements.recruiterInput.value);
                showToast('Link copied to clipboard', 'success');
            }
        });
    }
}

export function destroy() {}
