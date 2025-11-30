

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

function renderSkillRadar() {
    const container = document.getElementById('skill-radar-container');
    if (!container) return;

    // 1. Gather Data
    const journeys = learningPathService.getAllJourneys();
    // Default categories if empty
    const categories = ['Tech', 'Science', 'History', 'Arts', 'Biz']; 
    const scores = { 'Tech': 10, 'Science': 10, 'History': 10, 'Arts': 10, 'Biz': 10 }; // Base stats

    // Mapping loosely based on style classes or keywords
    journeys.forEach(j => {
        const goal = j.goal.toLowerCase();
        let cat = 'Tech'; // Default
        if (goal.includes('history') || goal.includes('war') || goal.includes('ancient')) cat = 'History';
        else if (goal.includes('biology') || goal.includes('physics') || goal.includes('space')) cat = 'Science';
        else if (goal.includes('art') || goal.includes('music') || goal.includes('design')) cat = 'Arts';
        else if (goal.includes('business') || goal.includes('finance') || goal.includes('market')) cat = 'Biz';
        
        // Add level to score (cap at 100 for visual sanity)
        scores[cat] = Math.min(100, scores[cat] + (j.currentLevel * 5));
    });

    // 2. Generate SVG
    const size = 200;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 80;
    const count = categories.length;
    
    const angleStep = (Math.PI * 2) / count;
    
    // Calculate points
    const points = categories.map((cat, i) => {
        const value = scores[cat];
        const normalized = value / 100; // 0 to 1
        const r = normalized * radius;
        const angle = (i * angleStep) - (Math.PI / 2); // Start at top
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        return `${x},${y}`;
    }).join(' ');

    // Background Web
    let webSVG = '';
    for (let ring = 1; ring <= 4; ring++) {
        const r = (radius / 4) * ring;
        const ringPoints = categories.map((_, i) => {
            const angle = (i * angleStep) - (Math.PI / 2);
            return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
        }).join(' ');
        webSVG += `<polygon points="${ringPoints}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
    }
    
    // Axis Lines & Labels
    let axisSVG = '';
    let labelsSVG = '';
    categories.forEach((cat, i) => {
        const angle = (i * angleStep) - (Math.PI / 2);
        const x2 = cx + Math.cos(angle) * radius;
        const y2 = cy + Math.sin(angle) * radius;
        
        // Axis
        axisSVG += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
        
        // Label
        const lx = cx + Math.cos(angle) * (radius + 20);
        const ly = cy + Math.sin(angle) * (radius + 20);
        const anchor = lx < cx ? 'end' : (lx > cx ? 'start' : 'middle');
        labelsSVG += `<text x="${lx}" y="${ly}" fill="rgba(255,255,255,0.6)" font-size="10" font-family="monospace" text-anchor="${anchor}" alignment-baseline="middle">${cat}</text>`;
    });

    container.innerHTML = `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            ${webSVG}
            ${axisSVG}
            <polygon points="${points}" fill="rgba(0, 184, 212, 0.3)" stroke="#00b8d4" stroke-width="2" />
            ${labelsSVG}
            <circle cx="${cx}" cy="${cy}" r="3" fill="#fff"/>
        </svg>
    `;
}

function renderXPHistoryChart() {
    const container = document.getElementById('xp-history-container');
    if (!container) return;

    // 1. Get History sorted ascending
    const history = historyService.getHistory().reverse(); 
    
    // 2. Compute Cumulative XP over time
    let cumulative = 0;
    const dataPoints = history
        .filter(h => h.xpGained > 0)
        .map((h, i) => {
            cumulative += h.xpGained;
            return cumulative;
        });

    if (dataPoints.length < 2) {
        container.innerHTML = '<p style="text-align:center;color:var(--color-text-secondary);padding-top:4rem;">Complete more missions to see your growth.</p>';
        return;
    }

    // 3. Generate SVG Line Chart
    const width = container.clientWidth || 300;
    const height = 200;
    const padding = 20;
    
    const maxVal = Math.max(...dataPoints);
    const minVal = 0; // Start from 0
    
    // Normalize points
    const pts = dataPoints.map((val, i) => {
        const x = padding + (i / (dataPoints.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((val / maxVal) * (height - 2 * padding));
        return `${x},${y}`;
    }).join(' ');

    // Fill area
    const firstX = padding;
    const lastX = width - padding;
    const bottomY = height - padding;
    const fillPath = `${firstX},${bottomY} ${pts} ${lastX},${bottomY}`;

    container.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <!-- Grid lines -->
            <line x1="${padding}" y1="${bottomY}" x2="${width-padding}" y2="${bottomY}" stroke="rgba(255,255,255,0.1)" />
            <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${bottomY}" stroke="rgba(255,255,255,0.1)" />
            
            <!-- Area Fill -->
            <polygon points="${fillPath}" fill="var(--color-primary-transparent)" />
            
            <!-- Line -->
            <polyline points="${pts}" fill="none" stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            
            <!-- Dots -->
            ${dataPoints.map((val, i) => {
                const x = padding + (i / (dataPoints.length - 1)) * (width - 2 * padding);
                const y = height - padding - ((val / maxVal) * (height - 2 * padding));
                return `<circle cx="${x}" cy="${y}" r="3" fill="#fff" />`;
            }).join('')}
        </svg>
    `;
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
    renderSkillRadar();
    renderXPHistoryChart(); // Call new chart renderer
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
            requestAnimationFrame(renderXPHistoryChart); // Re-render chart on resize
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