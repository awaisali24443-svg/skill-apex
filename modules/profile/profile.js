
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';

let resizeObserver;

function renderStats() {
    const gamificationStats = gamificationService.getStats();
    const history = historyService.getHistory();
    const profileStats = gamificationService.getProfileStats(history);

    // Level and XP
    const levelEl = document.getElementById('profile-level-text');
    if (levelEl) levelEl.textContent = `Level ${gamificationStats.level}`;
    
    const xpForNext = gamificationService.getXpForNextLevel(gamificationStats.level);
    const xpPercent = (gamificationStats.xp / xpForNext) * 100;
    
    const barFill = document.getElementById('xp-bar-fill');
    if (barFill) barFill.style.width = `${xpPercent}%`;
    
    const xpText = document.getElementById('xp-text');
    if (xpText) xpText.textContent = `${gamificationStats.xp} / ${xpForNext} XP`;

    // Stat cards
    const streakEl = document.getElementById('streak-stat');
    if (streakEl) streakEl.textContent = gamificationStats.currentStreak;
    
    const quizEl = document.getElementById('quizzes-stat');
    if (quizEl) quizEl.textContent = profileStats.totalQuizzes;
    
    const avgEl = document.getElementById('avg-score-stat');
    if (avgEl) avgEl.textContent = `${profileStats.averageScore}%`;
}

function renderQuests() {
    const quests = gamificationService.getDailyQuests();
    const list = document.getElementById('daily-quests-list');
    
    if (!quests || quests.length === 0) {
        if (list) list.innerHTML = '<p style="text-align:center; color:var(--color-text-secondary);">No active quests.</p>';
        return;
    }

    if (list) {
        list.innerHTML = quests.map(quest => `
            <div class="quest-item ${quest.completed ? 'completed' : ''}">
                <div class="quest-status-icon">
                    <svg class="icon"><use href="/assets/icons/feather-sprite.svg#${quest.completed ? 'check-circle' : 'circle'}"/></svg>
                </div>
                <span class="quest-text">${quest.text}</span>
                <span class="quest-xp">+${quest.xp} XP</span>
            </div>
        `).join('');
    }
}

function renderAchievements() {
    const achievements = gamificationService.getAchievements();
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;
    
    grid.innerHTML = '';

    achievements.forEach(ach => {
        const card = document.createElement('div');
        card.className = `achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`;
        card.setAttribute('title', ach.description);

        let iconStyle = '';
        if (ach.unlocked && ach.color) {
            iconStyle = `background: ${ach.color}; color: white; box-shadow: 0 0 20px ${ach.color};`;
        }

        card.innerHTML = `
            <div class="achievement-icon" style="${iconStyle}">
                <svg><use href="/assets/icons/feather-sprite.svg#${ach.icon}"/></svg>
            </div>
            <h3 class="achievement-name">${ach.name}</h3>
            <p class="achievement-description">${ach.description}</p>
            <span class="achievement-status-label">${ach.unlocked ? 'DECRYPTED' : 'LOCKED'}</span>
        `;
        grid.appendChild(card);
    });
}

function renderNeuralNexus() {
    const container = document.getElementById('neural-nexus');
    const svgLayer = document.getElementById('nexus-connections');
    if (!container || !svgLayer) return;

    // 1. Config Check
    const { config } = stateService.getState();
    const isLiteMode = config.animationIntensity !== 'full';
    const visualizerContainer = document.querySelector('.nexus-visualizer-container');
    
    if (isLiteMode) {
        visualizerContainer.classList.add('nexus-lite');
    } else {
        visualizerContainer.classList.remove('nexus-lite');
    }

    // 2. Clear previous nodes/lines
    container.querySelectorAll('.nexus-node').forEach(n => n.remove());
    svgLayer.innerHTML = ''; // Clear SVG paths

    // 3. Get Data
    const journeys = learningPathService.getAllJourneys();
    const history = historyService.getHistory();
    const healthStats = gamificationService.getDetailedTopicHealth(history);

    if (journeys.length === 0) return;

    // 4. Calculate Layout (Responsive)
    const containerRect = visualizerContainer.getBoundingClientRect();
    const minDim = Math.min(containerRect.width, containerRect.height);
    const radius = Math.max(100, minDim * 0.35);
    
    journeys.forEach((journey, index) => {
        const angle = (index / journeys.length) * 2 * Math.PI - (Math.PI / 2);
        
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        // 5. Create Node
        const node = document.createElement('div');
        const topicName = journey.goal.split('-')[0].trim();
        const stats = healthStats[topicName] || { status: 'Stable', health: 100 };
        const statusClass = stats.status.toLowerCase();

        node.className = `nexus-node ${statusClass}`;
        node.style.transform = `translate(${x}px, ${y}px)`;
        
        const visual = document.createElement('div');
        visual.className = 'node-visual';
        visual.textContent = topicName.charAt(0).toUpperCase();
        
        node.appendChild(visual);

        const label = document.createElement('div');
        label.className = 'nexus-node-label';
        label.innerHTML = `<strong>${topicName}</strong><br>Lvl ${journey.currentLevel} • ${stats.status}`;
        node.appendChild(label);

        node.addEventListener('click', () => {
            stateService.setNavigationContext({ topic: journey.goal });
            window.location.hash = `#/game/${encodeURIComponent(journey.goal)}`;
        });

        node.addEventListener('mouseenter', () => {
            const line = document.getElementById(`line-${index}`);
            if (line) line.classList.add('active');
        });
        node.addEventListener('mouseleave', () => {
            const line = document.getElementById(`line-${index}`);
            if (line) line.classList.remove('active');
        });

        container.appendChild(node);

        svgLayer.setAttribute("viewBox", "-300 -300 600 600");
        
        const cx = x * 0.5; 
        const cy = y * 0.5;
        
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("id", `line-${index}`);
        path.setAttribute("class", "connection-path");
        
        svgLayer.style.overflow = 'visible';
        
        svgLayer.setAttribute("viewBox", `${-containerRect.width/2} ${-containerRect.height/2} ${containerRect.width} ${containerRect.height}`);
        
        const d = `M 0 0 Q ${cx} ${cy} ${x} ${y}`;
        path.setAttribute("d", d);
        
        svgLayer.appendChild(path);
    });
}

function handleUpdate() {
    renderStats();
    renderQuests();
    renderAchievements();
    renderNeuralNexus();
}

export function init() {
    handleUpdate();
    
    const container = document.querySelector('.nexus-visualizer-container');
    if (container) {
        resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(renderNeuralNexus);
        });
        resizeObserver.observe(container);
    }

    window.addEventListener('gamification-updated', handleUpdate);
}

export function destroy() {
    window.removeEventListener('gamification-updated', handleUpdate);
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
}
