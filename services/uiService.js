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
    document.body.addEventListener('click', resumeAudio);
    document.body.addEventListener('keydown', resumeAudio);
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
        toast.addEventListener('transitionend', () => toast.remove());
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
    const container = document.getElementById('modal-container');
    if (!container) return Promise.resolve(false);

    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-text').textContent = text;
    document.getElementById('modal-confirm-btn').textContent = confirmText;
    document.getElementById('modal-cancel-btn').style.display = isAlert ? 'none' : 'inline-block';
    
    const inputContainer = document.getElementById('modal-input-container');
    const input = document.getElementById('modal-input');
    
    if (isPrompt) {
        inputContainer.classList.remove('hidden');
        input.value = promptValue;
    } else {
        inputContainer.classList.add('hidden');
    }
    
    container.classList.remove('hidden');
    
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const closeHandler = (value) => {
            container.classList.add('hidden');
            // Clone and replace buttons to remove all old event listeners
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            resolve(value);
        };
        
        document.getElementById('modal-confirm-btn').onclick = () => closeHandler(isPrompt ? input.value : true);
        document.getElementById('modal-cancel-btn').onclick = () => closeHandler(isPrompt ? null : false);
    });
}
window.showConfirmationModal = showConfirmationModal;

export function showLevelUpModal(newLevel) {
    const container = document.getElementById('level-up-container');
    if (!container) return;
    
    document.getElementById('level-up-number').textContent = newLevel;
    container.classList.remove('hidden');

    const continueBtn = document.getElementById('level-up-continue-btn');
    const closeHandler = () => container.classList.add('hidden');
    continueBtn.addEventListener('click', closeHandler, { once: true });
}
window.showLevelUpModal = showLevelUpModal;
