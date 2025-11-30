
import * as gamificationService from '../../services/gamificationService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';

function renderProfile() {
    const stats = gamificationService.getStats();
    const userEmail = firebaseService.getUserEmail();
    const userId = firebaseService.getUserId() || 'guest_123';

    // 1. User Identity
    const name = userEmail ? userEmail.split('@')[0] : 'Rene Stanley';
    document.querySelector('.user-name').textContent = name;
    document.getElementById('user-email-text').textContent = userEmail || 'stanley@saturday.com';
    
    // 2. Recruitment
    const shortId = userId.substring(0, 5).toUpperCase();
    document.getElementById('recruiter-id-input').value = `recruiter_id=${shortId}`;

    // 3. Progress Widget
    // Calculate level progress
    const xpCurrent = stats.xp;
    const xpNext = gamificationService.getXpForNextLevel(stats.level);
    const percent = Math.min(100, Math.round((xpCurrent / xpNext) * 100)) || 25; // Default to 25 if 0 for visual match
    
    document.getElementById('progress-percent').textContent = `${percent}%`;
    document.getElementById('progress-fill').style.width = `${percent}%`;

    renderBadges(stats);
}

function renderBadges(stats) {
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = '';

    // Hardcoded list to match the "Sparked" design request exactly
    // but dynamically mapped to real app stats where possible
    const badges = [
        {
            name: "Signed Up",
            desc: "Create your personal account",
            shape: "shape-circle",
            icon: "edit-2", // Pen
            progress: 100,
            completed: true
        },
        {
            name: "Volunteer",
            desc: "Complete your first volunteer shift",
            shape: "shape-pentagon",
            icon: "heart", 
            progress: 100,
            completed: stats.totalQuizzesCompleted > 0
        },
        {
            name: "Host",
            desc: "Number of events organized",
            shape: "shape-hexagon",
            icon: "box", 
            current: stats.currentStreak,
            target: 5,
            progress: (stats.currentStreak / 5) * 100,
            completed: false
        },
        {
            name: "Member",
            desc: "Number of events organized",
            shape: "shape-shield",
            icon: "user",
            current: 0,
            target: 1,
            progress: 0,
            completed: false
        },
        {
            name: "Recruiter",
            desc: "Recruit at least 1 new member",
            shape: "shape-shield", // Silver shield style
            icon: "users",
            current: 0,
            target: 1,
            progress: 0,
            completed: false
        },
        {
            name: "10 Recruits",
            desc: "Recruit at least 10 new members",
            shape: "shape-shield",
            icon: "star",
            current: 0,
            target: 10,
            progress: 0,
            completed: false
        },
        {
            name: "100 Recruits",
            desc: "Complete your first volunteer shift",
            shape: "shape-shield",
            icon: "award",
            current: 0,
            target: 100,
            progress: 0,
            completed: false
        },
        {
            name: "Donor",
            desc: "Become a donor of a campaign",
            shape: "shape-shield",
            icon: "gift",
            current: 0,
            target: 1,
            progress: 0,
            completed: false
        }
    ];

    badges.forEach(b => {
        const card = document.createElement('div');
        card.className = 'badge-card';
        
        let metaHtml = '';
        let progressHtml = '';
        let checkHtml = '';

        if (b.completed) {
            progressHtml = `<div class="badge-progress-bg"><div class="badge-progress-fill" style="width: 100%; background-color: var(--color-success);"></div></div>`;
            metaHtml = `<div class="badge-meta" style="color: var(--color-success);">1/1</div>`;
            checkHtml = `<svg class="check-icon"><use href="assets/icons/feather-sprite.svg#check-circle"/></svg>`;
        } else {
            const p = Math.min(100, Math.max(0, b.progress));
            const current = b.current !== undefined ? b.current : 0;
            const target = b.target !== undefined ? b.target : 1;
            
            progressHtml = `<div class="badge-progress-bg"><div class="badge-progress-fill" style="width: ${p}%;"></div></div>`;
            metaHtml = `<div class="badge-meta">${current}/${target}</div>`;
        }

        card.innerHTML = `
            <div class="badge-icon-container">
                <div class="${b.shape}"></div>
                <svg class="icon"><use href="assets/icons/feather-sprite.svg#${b.icon}"/></svg>
            </div>
            <div class="title-row">
                <h4 class="badge-title">${b.name}</h4>
                ${checkHtml}
            </div>
            <p class="badge-desc">${b.desc}</p>
            <div class="badge-status">
                ${progressHtml}
                ${metaHtml}
            </div>
        `;
        grid.appendChild(card);
    });
}

function setupListeners() {
    const copyBtn = document.getElementById('copy-ref-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const input = document.getElementById('recruiter-id-input');
            navigator.clipboard.writeText(input.value);
            showToast('Code copied!', 'success');
        });
    }
}

export function init() {
    renderProfile();
    setupListeners();
}

export function destroy() {
    // cleanup
}
