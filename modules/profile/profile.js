

import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';

function renderStats() {
    const gamificationStats = gamificationService.getStats();
    const history = historyService.getHistory();
    const profileStats = gamificationService.getProfileStats(history);

    // Level and XP
    document.getElementById('profile-level-text').textContent = `Level ${gamificationStats.level}`;
    const xpForNext = gamificationService.getXpForNextLevel(gamificationStats.level);
    const xpPercent = (gamificationStats.xp / xpForNext) * 100;
    document.getElementById('xp-bar-fill').style.width = `${xpPercent}%`;
    document.getElementById('xp-text').textContent = `${gamificationStats.xp} / ${xpForNext} XP`;

    // Stat cards
    document.getElementById('streak-stat').textContent = gamificationStats.currentStreak;
    document.getElementById('quizzes-stat').textContent = profileStats.totalQuizzes;
    document.getElementById('avg-score-stat').textContent = `${profileStats.averageScore}%`;
}

function renderQuests() {
    const quests = gamificationService.getDailyQuests();
    const list = document.getElementById('daily-quests-list');
    
    if (!quests || quests.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--color-text-secondary);">No active quests.</p>';
        return;
    }

    list.innerHTML = quests.map(quest => `
        <div class="quest-item ${quest.completed ? 'completed' : ''}">
            <div class="quest-left">
                <div class="quest-status-icon">
                    <svg class="icon"><use href="/assets/icons/feather-sprite.svg#${quest.completed ? 'check-circle' : 'circle'}"/></svg>
                </div>
                <span class="quest-text">${quest.text}</span>
            </div>
            <span class="quest-xp">+${quest.xp} XP</span>
        </div>
    `).join('');
}

function renderAchievements() {
    const achievements = gamificationService.getAchievements();
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = '';

    achievements.forEach(ach => {
        const card = document.createElement('div');
        card.className = `card achievement-card ${ach.unlocked ? 'unlocked' : ''}`;
        card.setAttribute('title', ach.description);

        let iconStyle = '';
        if (ach.unlocked && ach.color) {
            iconStyle = `background: ${ach.color}; border: none; box-shadow: 0 4px 15px rgba(0,0,0,0.3); color: white;`;
        }

        card.innerHTML = `
            <div class="achievement-icon" style="${iconStyle}">
                <svg><use href="/assets/icons/feather-sprite.svg#${ach.icon}"/></svg>
            </div>
            <div class="achievement-info">
                <h3 class="achievement-name">${ach.name}</h3>
                <p class="achievement-description">${ach.description}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    const myStats = gamificationService.getStats();
    
    // Mock Data for "Local" leaderboard environment
    const bots = [
        { name: "CodeNinja", xp: myStats.xp + 500 },
        { name: "AlgorithmAce", xp: myStats.xp + 200 },
        { name: "SystemDes", xp: Math.max(0, myStats.xp - 100) },
        { name: "DevOpsGuru", xp: Math.max(0, myStats.xp - 300) }
    ];
    
    const allUsers = [
        { name: "You (Learner)", xp: myStats.xp, isMe: true },
        ...bots
    ].sort((a, b) => b.xp - a.xp);

    tbody.innerHTML = allUsers.map((user, index) => {
        const isMeStyle = user.isMe ? 'background: var(--color-surface-active); font-weight:bold; color:var(--color-primary);' : '';
        const rank = index + 1;
        let rankIcon = rank;
        if(rank === 1) rankIcon = '🥇';
        if(rank === 2) rankIcon = '🥈';
        if(rank === 3) rankIcon = '🥉';

        return `
            <tr style="border-bottom:1px solid var(--color-border); ${isMeStyle}">
                <td style="padding:10px;">${rankIcon}</td>
                <td style="padding:10px;">${user.name}</td>
                <td style="padding:10px; text-align:right;">${user.xp} XP</td>
            </tr>
        `;
    }).join('');
}

export function init() {
    renderStats();
    renderQuests();
    renderLeaderboard();
    renderAchievements();
}

export function destroy() {
    // No event listeners to clean up
}
