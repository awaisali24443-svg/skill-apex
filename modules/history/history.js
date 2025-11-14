import * as historyService from '../../services/historyService.js';
import { showConfirmationModal } from '../../services/modalService.js';

let container;
let clearBtn;
let emptyMessage;
let template;
let appStateRef; // To store appState for click handler
let gridClickHandler; // To store the handler for removal in destroy

function renderHistory() {
    const history = historyService.getHistory();
    container.innerHTML = '';

    if (history.length === 0) {
        emptyMessage.style.display = 'block';
        clearBtn.disabled = true;
    } else {
        emptyMessage.style.display = 'none';
        clearBtn.disabled = false;
        
        history.forEach(item => {
            const card = template.content.cloneNode(true);
            const historyItemDiv = card.querySelector('.history-item');
            historyItemDiv.dataset.topic = item.topic; 

            const scorePercent = item.totalQuestions > 0 ? Math.round((item.score / item.totalQuestions) * 100) : 0;
            
            historyItemDiv.querySelector('.history-topic').textContent = item.topic;
            historyItemDiv.querySelector('.history-date').textContent = new Date(item.date).toLocaleDateString();
            historyItemDiv.querySelector('.history-score').textContent = `Score: ${item.score} / ${item.totalQuestions} (${scorePercent}%)`;
            historyItemDiv.querySelector('.score-bar-fill').style.width = `${scorePercent}%`;

            container.appendChild(card);
        });
    }
}

async function handleClearHistory() {
    const confirmed = await showConfirmationModal({
        title: 'Clear Quiz History',
        message: 'Are you sure you want to delete all your past quiz results? This action cannot be undone.',
        confirmText: 'Yes, Clear History',
    });

    if (confirmed) {
        historyService.clearHistory();
        renderHistory();
    }
}

function handleGridClick(event) {
    const retryButton = event.target.closest('.retry-btn');
    if (retryButton) {
        const historyItem = retryButton.closest('.history-item');
        if (historyItem) {
            const topic = historyItem.dataset.topic;

            if (topic && appStateRef) {
                appStateRef.context = {
                    topic: topic,
                    numQuestions: 10, // Default for retries
                    difficulty: 'medium' // Default for retries
                };
                window.location.hash = '/loading';
            }
        }
    }
}


export function init(appState) {
    appStateRef = appState;
    container = document.getElementById('history-grid');
    clearBtn = document.getElementById('clear-history-btn');
    emptyMessage = document.getElementById('empty-history-message');
    template = document.getElementById('history-item-template');

    clearBtn.addEventListener('click', handleClearHistory);
    
    // Add event listener for retaking quizzes from the grid
    gridClickHandler = handleGridClick;
    container.addEventListener('click', gridClickHandler);
    
    renderHistory();
}

export function destroy() {
    if (clearBtn) {
        clearBtn.removeEventListener('click', handleClearHistory);
    }
    if (container && gridClickHandler) {
        container.removeEventListener('click', gridClickHandler);
    }
}
