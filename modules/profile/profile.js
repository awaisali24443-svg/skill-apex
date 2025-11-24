
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';

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
}

function renderAchievements() {
    const achievements = gamificationService.getAchievements();
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;
    
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

    // 4. Calculate Layout
    const containerRect = container.getBoundingClientRect();
    // Use a virtual center for calculations (0,0 is center of container)
    // But SVG needs absolute coords relative to container (width/2, height/2)
    // Since the container is responsive, we rely on percent or absolute logic.
    // Simpler: Assume container is flex centered. We just need radius.
    
    const radius = 140; 
    
    journeys.forEach((journey, index) => {
        const angle = (index / journeys.length) * 2 * Math.PI - (Math.PI / 2); // Start top
        
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        // 5. Create Node
        const node = document.createElement('div');
        const topicName = journey.goal.split('-')[0].trim();
        const stats = healthStats[topicName] || { status: 'Stable', health: 100 };
        const statusClass = stats.status.toLowerCase();

        node.className = `nexus-node ${statusClass}`;
        node.style.transform = `translate(${x}px, ${y}px)`; // Centered by CSS flex, then offset
        
        // Inner visual div
        const visual = document.createElement('div');
        visual.className = 'node-visual';
        
        // Optional icon or initial
        visual.textContent = topicName.charAt(0).toUpperCase();
        
        node.appendChild(visual);

        // Tooltip
        const label = document.createElement('div');
        label.className = 'nexus-node-label';
        label.innerHTML = `<strong>${topicName}</strong><br>Lvl ${journey.currentLevel} • ${stats.status}`;
        node.appendChild(label);

        // Click Handler
        node.addEventListener('click', () => {
            stateService.setNavigationContext({ topic: journey.goal });
            window.location.hash = `#/game/${encodeURIComponent(journey.goal)}`;
        });

        // Hover Handler for Line Highlight
        node.addEventListener('mouseenter', () => {
            const line = document.getElementById(`line-${index}`);
            if (line) line.classList.add('active');
        });
        node.addEventListener('mouseleave', () => {
            const line = document.getElementById(`line-${index}`);
            if (line) line.classList.remove('active');
        });

        container.appendChild(node);

        // 6. Create SVG Path (Bezier Curve)
        // We need coordinates relative to the SVG center (which is 50%, 50%)
        // Since SVG is 100% width/height, we can use percentage or viewbox.
        // Let's use a coordinate system where 0,0 is center.
        
        // We can map the div offsets (x,y) directly if we set SVG viewbox carefully.
        // Or simply: SVG spans the whole div. Center is (W/2, H/2).
        // The node transform translates from center. So node pos is (W/2 + x, H/2 + y).
        
        // HOWEVER: The container size might not be known perfectly at render time if hidden.
        // Hack: Use a fixed coordinate system for SVG and CSS transform the SVG layer if needed.
        // Better: Use JS to get center.
        
        // SIMPLIFIED: We know x,y are offsets from center.
        // Let's make SVG have overflow:visible and 0x0 size at center? No.
        // Let's map 50% + x px.
        
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("id", `line-${index}`);
        path.setAttribute("class", "connection-path");
        
        // Start at center (0,0 relative to center) -> we use calc() logic in d? No.
        // We have to use absolute units or percentage in SVG.
        // Let's assume a 600x600 coordinate space for the visualizer and scale it via CSS?
        // Easier: Use percentages combined with pixels? No SVG doesn't support calc in d attribute well.
        
        // Solution: We use a fixed viewbox -300 -300 600 600.
        // 0,0 is center.
        svgLayer.setAttribute("viewBox", "-300 -300 600 600");
        
        // Control point for curve (slight arc)
        const cx = x * 0.5; 
        const cy = y * 0.5;
        
        const d = `M 0 0 Q ${cx} ${cy} ${x} ${y}`;
        path.setAttribute("d", d);
        
        svgLayer.appendChild(path);
    });
}

export function init() {
    renderStats();
    renderQuests();
    renderAchievements();
    
    // Slight delay to ensure layout is stable for calculations if needed
    setTimeout(renderNeuralNexus, 50);
    
    // Re-render on resize to handle responsive layout if we used absolute coords
    // But since we used viewBox centered logic, it should scale automatically!
}

export function destroy() {
    // Cleanup
}
