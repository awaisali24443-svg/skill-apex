import * as historyService from '../../services/historyService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import * as stateService from '../../services/stateService.js';

let container;
let clearBtn;
let emptyMessage;
let template;
let gridClickHandler;

function renderHistory() {
    const history = historyService.getHistory();
    container.innerHTML = '';
    
    const cleanTopic = (topic) => topic.replace(/ - Level \d+$/, '').trim();

    if (history.length === 0) {
        emptyMessage.style.display = 'block';
        clearBtn.disabled = true;
        container.style.display = 'none';
    } else {
        emptyMessage.style.display = 'none';
        container.style.display = 'block';
        clearBtn.disabled = false;
        
        history.forEach((item, index) => {
            const clone = template.content.cloneNode(true);
            const entry = clone.querySelector('.history-entry');
            
            // Animation Stagger
            entry.style.animationDelay = `${index * 50}ms`;
            
            // Data processing
            const topicName = cleanTopic(item.topic);
            const scorePercent = item.totalQuestions > 0 ? Math.round((item.score / item.totalQuestions) * 100) : 0;
            const passed = scorePercent >= 60; // arbitrary pass threshold for visual styling

            entry.classList.add(passed ? 'passed' : 'failed');
            entry.querySelector('.history-card').dataset.topic = topicName;

            // Text Content
            entry.querySelector('.history-date').textContent = new Date(item.date).toLocaleString(undefined, { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
            });
            entry.querySelector('.history-topic').textContent = item.topic;
            entry.querySelector('.history-meta').textContent = `${item.score}/${item.totalQuestions} Correct • +${item.xpGained || 0} XP`;
            
            // Circular Chart
            entry.querySelector('.percentage').textContent = `${scorePercent}%`;
            // Stroke-dasharray: value, 100. Since circumference is roughly 100 in SVG viewbox logic (r=15.9155)
            setTimeout(() => {
                const circle = entry.querySelector('.circle');
                if (circle) circle.setAttribute('stroke-dasharray', `${scorePercent}, 100`);
            }, 100 + (index * 50));

            container.appendChild(clone);
        });
    }
}

async function handleClearHistory() {
    const confirmed = await showConfirmationModal({
        title: 'Clear Mission Log',
        message: 'This will wipe your entire timeline. All records of your past victories and defeats will be lost.',
        confirmText: 'Wipe Data',
        cancelText: 'Cancel',
        danger: true
    });

    if (confirmed) {
        historyService.clearHistory();
        renderHistory();
    }
}

function handleGridClick(event) {
    const retryButton = event.target.closest('.retry-btn');
    if (retryButton) {
        const historyCard = retryButton.closest('.history-card');
        if (historyCard) {
            const topic = historyCard.dataset.topic;
            if (topic) {
                stateService.setNavigationContext({ topic });
                window.location.hash = `#/game/${encodeURIComponent(topic)}`;
            }
        }
    }
}

export function init() {
    container = document.getElementById('history-timeline');
    clearBtn = document.getElementById('clear-history-btn');
    emptyMessage = document.getElementById('empty-history-message');
    template = document.getElementById('history-item-template');

    clearBtn.addEventListener('click', handleClearHistory);
    
    gridClickHandler = handleGridClick;
    container.addEventListener('click', gridClickHandler);
    
    renderHistory();
}

export function destroy() {
    if (clearBtn) clearBtn.removeEventListener('click', handleClearHistory);
    if (container && gridClickHandler) container.removeEventListener('click', gridClickHandler);
}