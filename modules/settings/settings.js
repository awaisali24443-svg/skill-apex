
import * as configService from '../../services/configService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import { LOCAL_STORAGE_KEYS } from '../../constants.js';
import { showToast } from '../../services/toastService.js';
import * as levelCacheService from '../../services/levelCacheService.js';

let elements = {};
const animationLevels = ['off', 'subtle', 'full'];

function setActiveThemeButton(button, instant = false) {
    if (!button) return;

    elements.themeToggleButtons.forEach(btn => {
        btn.setAttribute('aria-checked', 'false');
        btn.tabIndex = -1;
    });
    button.setAttribute('aria-checked', 'true');
    button.tabIndex = 0; 

    const indicator = elements.themeToggle.querySelector('.segmented-control-indicator');
    const containerRect = elements.themeToggle.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    
    const left = buttonRect.left - containerRect.left;
    const width = buttonRect.width;
    
    if (instant) indicator.style.transition = 'none';

    indicator.style.left = `${left}px`;
    indicator.style.width = `${width}px`;
    
    if (instant) setTimeout(() => { indicator.style.transition = ''; }, 50);
}

function loadSettings() {
    const config = configService.getConfig();
    elements.soundToggle.checked = config.enableSound;

    const activeThemeButton = elements.themeToggle.querySelector(`button[data-theme="${config.theme}"]`);
    setActiveThemeButton(activeThemeButton, true); 
    
    elements.animationSlider.value = animationLevels.indexOf(config.animationIntensity);
    
    if (elements.timerSelect) {
        elements.timerSelect.value = config.quizTimer || 60;
    }
    if (elements.difficultySelect) {
        elements.difficultySelect.value = config.difficulty || 'medium';
    }
}

function handleSoundToggle() {
    configService.setConfig({ enableSound: elements.soundToggle.checked });
}

function handleAnimationChange() {
    const level = animationLevels[elements.animationSlider.value];
    configService.setConfig({ animationIntensity: level });
}

function handleTimerChange() {
    const duration = parseInt(elements.timerSelect.value, 10);
    configService.setConfig({ quizTimer: duration });
}

function handleDifficultyChange() {
    const diff = elements.difficultySelect.value;
    configService.setConfig({ difficulty: diff });
}

function handleThemeToggle(event) {
    const button = event.target.closest('button[data-theme]');
    if (button && button.getAttribute('aria-checked') !== 'true') {
        const newTheme = button.dataset.theme;
        setActiveThemeButton(button);
        configService.setConfig({ theme: newTheme });
    }
}

function handleThemeToggleKeydown(event) {
    const { key } = event;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;

    event.preventDefault();

    const buttons = Array.from(elements.themeToggleButtons);
    const checkedButton = elements.themeToggle.querySelector('button[aria-checked="true"]');
    let currentIndex = buttons.indexOf(checkedButton);

    if (key === 'ArrowLeft') {
        currentIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    } else if (key === 'ArrowRight') {
        currentIndex = (currentIndex + 1) % buttons.length;
    }

    const newButton = buttons[currentIndex];
    newButton.focus();
    const newTheme = newButton.dataset.theme;
    setActiveThemeButton(newButton);
    configService.setConfig({ theme: newTheme });
}

async function handleClearData() {
    const confirmed = await showConfirmationModal({
        title: 'Confirm Data Deletion',
        message: 'Are you sure you want to delete all your saved questions, learning paths, quiz history, and application settings? This action cannot be undone.',
        confirmText: 'Yes, Delete Everything',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        Object.values(LOCAL_STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        levelCacheService.clearAllLevels();
        showToast('All application data has been cleared.', 'success');
        setTimeout(() => window.location.reload(), 1000);
    }
}

function handleInstallClick() {
    const promptEvent = window.deferredInstallPrompt;
    if (!promptEvent) return;
    
    promptEvent.prompt();
    promptEvent.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the A2HS prompt');
        }
        window.deferredInstallPrompt = null;
        if(elements.installSection) elements.installSection.style.display = 'none';
    });
}

// PHASE 6: Mock Payment Logic
function handleUpgradeClick() {
    showConfirmationModal({
        title: 'Upgrade to Pro?',
        message: 'This is a demo. In production, this would open Stripe Checkout.\n\nBenefits:\n- Unlimited AI Requests\n- GPT-4 Level Tuning\n- Cloud Sync',
        confirmText: 'Pay $0.00 (Demo)',
        cancelText: 'Maybe Later'
    }).then(confirmed => {
        if (confirmed) {
            showToast('Welcome to Pro! (Demo Mode)', 'success');
            const btn = document.getElementById('upgrade-pro-btn');
            if(btn) {
                btn.textContent = "Pro Active";
                btn.disabled = true;
            }
        }
    });
}

export function init() {
    elements = {
        soundToggle: document.getElementById('sound-toggle'),
        animationSlider: document.getElementById('animation-slider'),
        timerSelect: document.getElementById('quiz-timer-select'),
        difficultySelect: document.getElementById('difficulty-select'),
        clearDataBtn: document.getElementById('clear-data-btn'),
        themeToggle: document.getElementById('theme-toggle-group'),
        themeToggleButtons: document.querySelectorAll('#theme-toggle-group button'),
        installSection: document.getElementById('install-app-section'),
        installBtn: document.getElementById('install-app-btn'),
        upgradeBtn: document.getElementById('upgrade-pro-btn'),
    };

    loadSettings();

    elements.soundToggle.addEventListener('change', handleSoundToggle);
    elements.animationSlider.addEventListener('input', handleAnimationChange);
    elements.timerSelect.addEventListener('change', handleTimerChange);
    elements.difficultySelect.addEventListener('change', handleDifficultyChange);
    elements.clearDataBtn.addEventListener('click', handleClearData);
    elements.themeToggle.addEventListener('click', handleThemeToggle);
    elements.themeToggle.addEventListener('keydown', handleThemeToggleKeydown);
    if(elements.upgradeBtn) elements.upgradeBtn.addEventListener('click', handleUpgradeClick);

    if (window.deferredInstallPrompt) {
        elements.installSection.style.display = 'block';
        elements.installBtn.addEventListener('click', handleInstallClick);
    }
}

export function destroy() {
    if (elements.soundToggle) elements.soundToggle.removeEventListener('change', handleSoundToggle);
    if (elements.animationSlider) elements.animationSlider.removeEventListener('input', handleAnimationChange);
    if (elements.timerSelect) elements.timerSelect.removeEventListener('change', handleTimerChange);
    if (elements.difficultySelect) elements.difficultySelect.removeEventListener('change', handleDifficultyChange);
    if (elements.clearDataBtn) elements.clearDataBtn.removeEventListener('click', handleClearData);
    if (elements.themeToggle) {
        elements.themeToggle.removeEventListener('click', handleThemeToggle);
        elements.themeToggle.removeEventListener('keydown', handleThemeToggleKeydown);
    }
    if (elements.installBtn) elements.installBtn.removeEventListener('click', handleInstallClick);
    if (elements.upgradeBtn) elements.upgradeBtn.removeEventListener('click', handleUpgradeClick);
    elements = {};
}