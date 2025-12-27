
import * as historyService from '../../services/historyService.js';
import * as libraryService from '../../services/libraryService.js';
import * as vfxService from '../../services/vfxService.js';

let elements = {};

function renderDecayGraph() {
    const container = document.getElementById('decay-lines');
    if (!container) return;

    const width = container.clientWidth;
    const height = 200;
    
    // Simulate a decay curve based on actual library status
    const library = libraryService.getLibrary();
    let avgInterval = 1;
    if (library.length > 0) {
        avgInterval = library.reduce((acc, q) => acc + (q.srs.interval || 1), 0) / library.length;
    }

    const points = [];
    for (let i = 0; i <= 10; i++) {
        const x = (i / 10) * width;
        // Exponential decay simulation: y = 100 * e^(-day/stability)
        const y = height - (height * Math.exp(-i / (avgInterval * 2)));
        points.push(`${x},${y}`);
    }

    container.innerHTML = `
        <svg width="100%" height="100%" style="overflow: visible;">
            <defs>
                <linearGradient id="decayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <path d="M 0,${height} L ${points.join(' L ')} L ${width},${height} Z" fill="url(#decayGrad)" />
            <path d="M 0,${height} L ${points.join(' L ')}" fill="none" stroke="var(--color-primary)" stroke-width="3" />
            ${points.map((p, i) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="4" fill="var(--color-background)" stroke="var(--color-primary)" stroke-width="2" />`).join('')}
        </svg>
    `;
}

export function init() {
    elements = {
        gradeLetter: document.getElementById('grade-letter'),
        totalTime: document.getElementById('total-time'),
        knowledgeIndex: document.getElementById('knowledge-index'),
        topicBars: document.getElementById('topic-bars')
    };

    const history = historyService.getHistory();
    if (history.length > 0) {
        elements.knowledgeIndex.textContent = new Set(history.map(h => h.topic.split('-')[0])).size;
        elements.totalTime.textContent = `${Math.round(history.length * 0.5)}h`;
        elements.gradeLetter.textContent = 'A'; // Logic placeholder
    }

    renderDecayGraph();
    window.addEventListener('resize', renderDecayGraph);
}

export function destroy() {
    window.removeEventListener('resize', renderDecayGraph);
}
