
import * as gamificationService from '../../services/gamificationService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';

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
    
    if (photoURL) {
        elements.avatarImg.src = photoURL;
    }
    
    // 2. Recruitment Link
    const shortId = userId.substring(0, 6).toUpperCase();
    elements.recruiterInput.value = `skillapex.com/join/${shortId}`;

    // 3. Circle Progress
    const xpCurrent = stats.xp;
    const xpNext = gamificationService.getXpForNextLevel(stats.level);
    const percent = Math.min(100, Math.round((xpCurrent / xpNext) * 100)) || 0;
    
    elements.progressPercent.textContent = `${percent}%`;
    setTimeout(() => {
        if(elements.progressCircle) elements.progressCircle.setAttribute('stroke-dasharray', `${percent}, 100`);
    }, 100);

    renderAchievements(stats);
    
    // Hide Skeleton, Show Content
    if (elements.skeleton) elements.skeleton.style.display = 'none';
    if (elements.content) elements.content.style.display = 'grid';
}

function renderAchievements(stats) {
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = '';

    const achievements = gamificationService.getAchievementsProgress();

    achievements.forEach(ach => {
        const card = document.createElement('div');
        card.className = `achievement-card ${ach.isUnlocked ? 'unlocked' : 'locked'}`;
        
        // Define Metallic Colors for the SVG via CSS Color property
        // The 3D filter uses this color for the base fill, while lighting stays white
        let metalColor = '#444'; // Default Locked
        if (ach.isUnlocked) {
            switch(ach.currentTierName) {
                case 'Bronze': metalColor = '#CD7F32'; break; // Bronze
                case 'Silver': metalColor = '#C0C0C0'; break; // Silver
                case 'Gold': metalColor = '#FFD700'; break;   // Gold
                case 'Diamond': metalColor = '#00BFFF'; break; // Deep Sky Blue (Diamond)
                default: metalColor = '#ffffff';
            }
        }

        let progressHtml = '';
        if (ach.isMaxed) {
            progressHtml = `
                <div class="ach-progress-bar"><div class="ach-progress-fill" style="width:100%; background:var(--color-success); box-shadow:0 0 10px var(--color-success)"></div></div>
                <span class="ach-meta" style="color:var(--color-success)">MAX TIER</span>
            `;
        } else {
            progressHtml = `
                <div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${ach.progressPercent}%"></div></div>
                <span class="ach-meta">${ach.currentValue} / ${ach.target}</span>
            `;
        }

        card.innerHTML = `
            <div class="achievement-icon-wrapper" style="color: ${metalColor}">
                <svg class="icon"><use href="assets/icons/achievements.svg#${ach.icon}"/></svg>
            </div>
            <h4 class="ach-title">${ach.name}</h4>
            <div class="ach-tier-badge" style="font-size:0.7rem; text-transform:uppercase; color:${metalColor}; font-weight:700; margin-bottom:4px; text-shadow: 0 0 10px ${metalColor};">${ach.isUnlocked ? ach.currentTierName : 'Locked'}</div>
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
        // Optimistic UI update
        elements.avatarImg.src = e.target.result;
        
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
        avatarImg: document.getElementById('profile-avatar-img'),
        fileInput: document.getElementById('avatar-upload'),
        recruiterInput: document.getElementById('recruiter-id-input'),
        progressPercent: document.getElementById('progress-percent'),
        progressCircle: document.getElementById('progress-circle-path'),
        copyBtn: document.getElementById('copy-ref-btn'),
        skeleton: document.getElementById('profile-skeleton'),
        content: document.getElementById('profile-content')
    };
    
    // Simulate slight loading delay for skeleton effect if data is instant (better UX)
    if (gamificationService.getStats()) {
        setTimeout(renderProfile, 300);
    } else {
        renderProfile();
    }
    
    setupDragDrop();
    
    elements.editBtn.addEventListener('click', toggleNameEdit);
    elements.saveNameBtn.addEventListener('click', saveName);
    
    elements.copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(elements.recruiterInput.value);
        showToast('Link copied.', 'success');
    });
}

export function destroy() {}
