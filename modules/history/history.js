
import * as historyService from '../../services/historyService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import * as stateService from '../../services/stateService.js';
import { showToast } from '../../services/toastService.js';

let container;
let clearBtn;
let exportBtn;
let emptyMessage;
let template;
let gridClickHandler;
let transcriptModal;
let transcriptBody;
let closeTranscriptBtn;

function renderHistory() {
    const history = historyService.getHistory();
    container.innerHTML = '';
    
    const cleanTopic = (topic) => topic.replace(/ - Level \d+$/, '').trim();

    if (history.length === 0) {
        emptyMessage.style.display = 'block';
        clearBtn.disabled = true;
        exportBtn.disabled = true;
        container.style.display = 'none';
    } else {
        emptyMessage.style.display = 'none';
        container.style.display = 'block';
        clearBtn.disabled = false;
        exportBtn.disabled = false;
        
        history.forEach((item, index) => {
            const clone = template.content.cloneNode(true);
            const entry = clone.querySelector('.history-entry');
            const badgeContainer = entry.querySelector('.history-score-badge');
            const footer = entry.querySelector('.history-footer');
            
            entry.style.animationDelay = `${index * 50}ms`;
            
            // Common Info
            entry.querySelector('.history-date').textContent = new Date(item.date).toLocaleString(undefined, { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
            });
            entry.querySelector('.history-topic').textContent = item.topic;

            if (item.type === 'aural') {
                // --- AURAL SESSION RENDER ---
                entry.classList.add('aural');
                entry.querySelector('.history-meta').textContent = `Audio Session • ${Math.floor(item.duration / 60)}m ${item.duration % 60}s • +${item.xpGained || 0} XP`;
                
                badgeContainer.innerHTML = `<div class="aural-icon-badge"><svg class="icon"><use href="/assets/icons/feather-sprite.svg#mic"/></svg></div>`;
                
                footer.innerHTML = `<button class="btn-small transcript-btn" data-id="${item.id}"><svg class="icon"><use href="/assets/icons/feather-sprite.svg#message-circle"/></svg> Transcript</button>`;
                
                // Store transcript data on the button for easy access
                const btn = footer.querySelector('.transcript-btn');
                btn.itemData = item;

            } else {
                // --- QUIZ RENDER ---
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

                footer.innerHTML = `<button class="btn-small retry-btn"><svg class="icon"><use href="/assets/icons/feather-sprite.svg#rotate-ccw"/></svg> Retry</button>`;
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

function handleExportHistory() {
    const history = historyService.getHistory();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `knowledge_tester_history_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showToast("History exported to JSON!", "success");
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
    transcriptModal.style.display = 'block';
}

function handleGridClick(event) {
    // Handle Retry
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

    // Handle Transcript
    const transcriptBtn = event.target.closest('.transcript-btn');
    if (transcriptBtn) {
        const item = transcriptBtn.itemData;
        if (item) showTranscript(item);
    }
}

export function init() {
    container = document.getElementById('history-timeline');
    clearBtn = document.getElementById('clear-history-btn');
    exportBtn = document.getElementById('export-history-btn');
    emptyMessage = document.getElementById('empty-history-message');
    template = document.getElementById('history-item-template');
    
    transcriptModal = document.getElementById('transcript-modal');
    transcriptBody = document.getElementById('transcript-body');
    closeTranscriptBtn = document.getElementById('close-transcript-btn');

    clearBtn.addEventListener('click', handleClearHistory);
    exportBtn.addEventListener('click', handleExportHistory);
    
    gridClickHandler = handleGridClick;
    container.addEventListener('click', gridClickHandler);
    
    closeTranscriptBtn.addEventListener('click', () => {
        transcriptModal.style.display = 'none';
    });
    
    // Close modal on backdrop click
    transcriptModal.addEventListener('click', (e) => {
        if (e.target === transcriptModal) transcriptModal.style.display = 'none';
    });
    
    renderHistory();
}

export function destroy() {
    if (clearBtn) clearBtn.removeEventListener('click', handleClearHistory);
    if (exportBtn) exportBtn.removeEventListener('click', handleExportHistory);
    if (container && gridClickHandler) container.removeEventListener('click', gridClickHandler);
}
