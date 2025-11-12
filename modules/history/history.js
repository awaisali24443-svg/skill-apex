import * as historyService from '../../services/historyService.js';
import { initializeCardGlow } from '../../global/global.js';
import { showConfirmationModal } from '../../services/modalService.js';

let container;
let clearBtn;
let emptyMessage;
let template;

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
            const scorePercent = item.totalQuestions > 0 ? Math.round((item.score / item.totalQuestions) * 100) : 0;
            
            card.querySelector('.history-topic').textContent = item.topic;
            card.querySelector('.history-date').textContent = new Date(item.date).toLocaleDateString();
            card.querySelector('.history-score').textContent = `Score: ${item.score} / ${item.totalQuestions} (${scorePercent}%)`;
            card.querySelector('.score-bar-fill').style.width = `${scorePercent}%`;

            container.appendChild(card);
        });
        initializeCardGlow(container);
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


export function init(appState) {
    container = document.getElementById('history-grid');
    clearBtn = document.getElementById('clear-history-btn');
    emptyMessage = document.getElementById('empty-history-message');
    template = document.getElementById('history-item-template');

    clearBtn.addEventListener('click', handleClearHistory);
    
    renderHistory();
}

export function destroy() {
    if (clearBtn) {
        clearBtn.removeEventListener('click', handleClearHistory);
    }
}