
import * as historyService from '../../services/historyService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import * as stateService from '../../services/stateService.js';

let container;
let clearBtn;
let actionsContainer;
let emptyMessage;
let template;
let gridClickHandler;
let transcriptModal;
let transcriptBody;
let closeTranscriptBtn;

async function renderHistory() {
    if (!container) return; 

    // Force refresh from storage to catch new admin data
    historyService.init(); 
    const history = historyService.getHistory();
    
    container.innerHTML = '';
    
    const cleanTopic = (topic) => topic.replace(/ - Level \d+$/, '').trim();

    if (history.length === 0) {
        emptyMessage.style.display = 'flex';
        actionsContainer.style.display = 'none';
        container.style.display = 'none';
    } else {
        emptyMessage.style.display = 'none';
        container.style.display = 'block';
        actionsContainer.style.display = 'flex';
        
        history.forEach((item, index) => {
            const clone = template.content.cloneNode(true);
            const entry = clone.querySelector('.history-entry');
            const badgeContainer = entry.querySelector('.history-score-badge');
            const footer = entry.querySelector('.history-footer');
            
            entry.style.animationDelay = `${index * 50}ms`;
            
            const dateStr = new Date(item.date).toLocaleString(undefined, { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
            });
            entry.querySelector('.history-date').textContent = dateStr;
            entry.querySelector('.history-topic').textContent = item.topic;

            if (item.type === 'aural') {
                entry.classList.add('aural');
                entry.querySelector('.history-meta').textContent = `Audio Session • ${Math.floor(item.duration / 60)}m ${item.duration % 60}s • +${item.xpGained || 0} XP`;
                badgeContainer.innerHTML = `<div class="aural-icon-badge"><svg class="icon"><use href="assets/icons/feather-sprite.svg#mic"/></svg></div>`;
                footer.innerHTML = `<button class="btn-small transcript-btn"><svg class="icon"><use href="assets/icons/feather-sprite.svg#message-circle"/></svg> Transcript</button>`;
                
                const btn = footer.querySelector('.transcript-btn');
                btn.itemData = item; // Attach data directly to button element
            } else {
                const topicName = cleanTopic(item.topic);
                const scorePercent = item.totalQuestions > 0 ? Math.round((item.score / item.totalQuestions) * 100) : 0;
                const passed = scorePercent >= 60;

                entry.classList.add(passed ? 'passed' : 'failed');
                entry.querySelector('.history-card').dataset.topic = topicName;
                entry.querySelector('.history-meta').textContent = `${item.score}/${item.totalQuestions} Correct • +${item.xpGained || 0} XP`;
                
                badgeContainer.innerHTML = `
                    <svg viewBox="0 0 36 36" class="circular-chart">
                        <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path class="circle" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <span class="percentage">${scorePercent}%</span>
                `;
                
                setTimeout(() => {
                    const circle = badgeContainer.querySelector('.circle');
                    if (circle) circle.setAttribute('stroke-dasharray', `${scorePercent}, 100`);
                }, 100 + (index * 50));

                footer.innerHTML = `<button class="btn-small retry-btn"><svg class="icon"><use href="assets/icons/feather-sprite.svg#rotate-ccw"/></svg> Retry</button>`;
            }

            container.appendChild(clone);
        });
    }
}

async function handleClearHistory() {
    const confirmed = await showConfirmationModal({
        title: 'Clear Mission Log',
        message: 'This will wipe your entire timeline. All records of your past victories, defeats, and conversations will be lost.',
        confirmText: 'Wipe Data',
        cancelText: 'Cancel',
        danger: true
    });

    if (confirmed) {
        historyService.clearHistory();
        renderHistory();
    }
}

function showTranscript(item) {
    transcriptBody.innerHTML = '';
    if (item.transcript && item.transcript.length > 0) {
        item.transcript.forEach(msg => {
            const div = document.createElement('div');
            div.className = `transcript-line ${msg.sender}`;
            div.innerHTML = `<span class="transcript-label">${msg.sender === 'user' ? 'You' : 'AI Tutor'}</span>${msg.text}`;
            transcriptBody.appendChild(div);
        });
    } else {
        transcriptBody.innerHTML = '<p style="text-align:center; color:var(--color-text-secondary);">No transcript available for this session.</p>';
    }
    transcriptModal.style.display = 'flex';
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
        return;
    }

    const transcriptBtn = event.target.closest('.transcript-btn');
    if (transcriptBtn) {
        const item = transcriptBtn.itemData;
        if (item) showTranscript(item);
    }
}

export function init() {
    container = document.getElementById('history-timeline');
    actionsContainer = document.getElementById('history-actions-container');
    clearBtn = document.getElementById('clear-history-btn');
    emptyMessage = document.getElementById('empty-history-message');
    template = document.getElementById('history-item-template');
    
    transcriptModal = document.getElementById('transcript-modal');
    transcriptBody = document.getElementById('transcript-body');
    closeTranscriptBtn = document.getElementById('close-transcript-btn');

    if(clearBtn) clearBtn.addEventListener('click', handleClearHistory);
    
    gridClickHandler = handleGridClick;
    if(container) container.addEventListener('click', gridClickHandler);
    
    if(closeTranscriptBtn) {
        closeTranscriptBtn.addEventListener('click', () => {
            transcriptModal.style.display = 'none';
        });
    }
    
    if(transcriptModal) {
        transcriptModal.addEventListener('click', (e) => {
            if (e.target === transcriptModal) transcriptModal.style.display = 'none';
        });
    }
    
    window.addEventListener('history-updated', renderHistory);
    
    renderHistory();
}

export function destroy() {
    window.removeEventListener('history-updated', renderHistory);
    if (clearBtn) clearBtn.removeEventListener('click', handleClearHistory);
    if (container && gridClickHandler) container.removeEventListener('click', gridClickHandler);
}
