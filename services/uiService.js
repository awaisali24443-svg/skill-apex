// services/uiService.js
let audioCtx;
function getAudioContext() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) { console.error("Web Audio API not supported."); audioCtx = null; }
    }
    return audioCtx;
}

export function initUIEffects() {
    // Cursor Aura
    const aura = document.getElementById('cursor-aura');
    if (aura) {
        document.addEventListener('mousemove', e => {
            aura.style.transform = `translate(${e.clientX - 15}px, ${e.clientY - 15}px)`;
        });
    }

    // Audio context resume on first interaction
    const resumeAudio = () => {
        const context = getAudioContext();
        if (context && context.state === 'suspended') {
            context.resume();
        }
        document.body.removeEventListener('click', resumeAudio);
        document.body.removeEventListener('keydown', resumeAudio);
    };
    document.body.addEventListener('click', resumeAudio, { once: true });
    document.body.addEventListener('keydown', resumeAudio, { once: true });
}

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 4000);
}
window.showToast = showToast;

export function showWelcomeModal() {
    const overlay = document.getElementById('welcome-modal-overlay');
    const closeBtn = document.getElementById('welcome-modal-close-btn');
    if (!overlay || !closeBtn) return;
    
    const close = () => overlay.classList.add('hidden');
    overlay.classList.remove('hidden');
    closeBtn.addEventListener('click', close, { once: true });
}

export function showConfirmationModal({ title, text, confirmText = 'Confirm', isAlert = false, isPrompt = false, promptValue = '' }) {
    return new Promise((resolve) => {
        const container = document.getElementById('modal-container');
        if (!container) return resolve(isPrompt ? null : false);

        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-text').textContent = text;
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        confirmBtn.textContent = confirmText;
        cancelBtn.style.display = isAlert ? 'none' : 'inline-block';
        
        const inputContainer = document.getElementById('modal-input-container');
        const input = document.getElementById('modal-input');
        inputContainer.classList.toggle('hidden', !isPrompt);
        if (isPrompt) input.value = promptValue;
        
        container.classList.remove('hidden');

        const controller = new AbortController();
        const signal = controller.signal;
        
        const closeHandler = (value) => {
            container.classList.add('hidden');
            controller.abort(); // Remove all event listeners attached with this signal
            resolve(value);
        };

        // Allow closing by clicking the overlay
        container.addEventListener('click', (e) => {
            if (e.target === container) {
                closeHandler(isPrompt ? null : false);
            }
        }, { signal });
        
        confirmBtn.addEventListener('click', () => closeHandler(isPrompt ? input.value : true), { signal });
        cancelBtn.addEventListener('click', () => closeHandler(isPrompt ? null : false), { signal });
    });
}
window.showConfirmationModal = showConfirmationModal;

export function showLevelUpModal(newLevel) {
    const container = document.getElementById('level-up-container');
    if (!container) return;
    
    document.getElementById('level-up-number').textContent = newLevel;
    container.classList.remove('hidden');

    const continueBtn = document.getElementById('level-up-continue-btn');
    continueBtn.addEventListener('click', () => container.classList.add('hidden'), { once: true });
}
window.showLevelUpModal = showLevelUpModal;