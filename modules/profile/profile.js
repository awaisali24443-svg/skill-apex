
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';

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

function renderNeuralNexus() {
    const container = document.getElementById('neural-nexus');
    if (!container) return;

    // Check User Settings for Performance Mode
    const { config } = stateService.getState();
    const isLiteMode = config.animationIntensity !== 'full';

    if (isLiteMode) {
        container.classList.add('nexus-lite');
    } else {
        container.classList.remove('nexus-lite');
    }

    // Clear existing nodes (except core)
    const existingNodes = container.querySelectorAll('.nexus-node, .connection-line');
    existingNodes.forEach(n => n.remove());

    const journeys = learningPathService.getAllJourneys();
    const history = historyService.getHistory();
    const healthStats = gamificationService.getDetailedTopicHealth(history);

    if (journeys.length === 0) return;

    const centerX = 0; // Relative to container center, CSS handles positioning
    const centerY = 0;
    const radius = 100; // Base distance from core

    journeys.forEach((journey, index) => {
        const angle = (index / journeys.length) * 2 * Math.PI;
        // Distribute nodes in a circle
        // Add some random offset to make it look organic (only in Heavy Mode)
        const offset = isLiteMode ? 0 : (Math.random() * 40 - 20);
        const r = radius + offset; 
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        // Determine Size based on Level
        const size = Math.min(80, 40 + (journey.currentLevel * 2)); // Min 40px, max 80px

        // Determine Health Status
        const topicName = journey.goal.split('-')[0].trim();
        const stats = healthStats[topicName] || { status: 'Stable', health: 100 };
        const statusClass = stats.status.toLowerCase(); // stable, decaying, critical

        // Create Node
        const node = document.createElement('div');
        node.className = `nexus-node ${statusClass}`;
        node.style.width = `${size}px`;
        node.style.height = `${size}px`;
        // Use translate from center
        node.style.transform = `translate(${x}px, ${y}px)`; 
        
        // Tooltip Content
        const labelText = `${topicName} (Lvl ${journey.currentLevel})`;
        const healthText = stats.status === 'Stable' ? '' : ` • ${stats.status}`;
        
        node.innerHTML = `
            <div class="nexus-node-label">${labelText}${healthText}</div>
        `;

        // Click to Repair/Play
        node.addEventListener('click', () => {
            stateService.setNavigationContext({ topic: journey.goal });
            window.location.hash = `#/game/${encodeURIComponent(journey.goal)}`;
        });

        // Add Connection Line (Simple approach: rotated div)
        const line = document.createElement('div');
        line.className = 'connection-line';
        // Stop line at node edge (approx) to look cleaner
        const length = Math.sqrt(x*x + y*y) - (size/2); 
        const rotation = (Math.atan2(y, x) * 180 / Math.PI);
        
        line.style.width = `${length}px`;
        line.style.transform = `rotate(${rotation}deg)`;
        
        // Append
        container.appendChild(line);
        container.appendChild(node);
    });
}

export function init() {
    renderStats();
    renderQuests();
    renderAchievements();
    renderNeuralNexus();
}

export function destroy() {
    // No event listeners to clean up
}
