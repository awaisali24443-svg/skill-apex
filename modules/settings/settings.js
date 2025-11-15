import * as configService from '../../services/configService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import { LOCAL_STORAGE_KEYS } from '../../constants.js';
import { showToast } from '../../services/toastService.js';
import * as levelCacheService from '../../services/levelCacheService.js';

let elements = {};
const animationLevels = ['off', 'subtle', 'full'];

/**
 * Updates the visual state of the segmented theme toggle control.
 * Moves the indicator and sets ARIA attributes and tabindex for accessibility.
 * @param {HTMLElement} button - The theme button that should be active.
 * @param {boolean} [instant=false] - If true, applies changes without transition.
 */
function setActiveThemeButton(button, instant = false) {
    if (!button) return;

    elements.themeToggleButtons.forEach(btn => {
        btn.setAttribute('aria-checked', 'false');
        btn.tabIndex = -1; // Make non-selected buttons unfocusable via Tab
    });
    button.setAttribute('aria-checked', 'true');
    button.tabIndex = 0; // Make selected button focusable

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

/**
 * Loads current settings from the config service and updates the UI.
 */
function loadSettings() {
    const config = configService.getConfig();
    elements.soundToggle.checked = config.enableSound;

    const activeThemeButton = elements.themeToggle.querySelector(`button[data-theme="${config.theme}"]`);
    setActiveThemeButton(activeThemeButton, true); // Instant update on load
    
    elements.animationSlider.value = animationLevels.indexOf(config.animationIntensity);
}

function handleSoundToggle() {
    configService.setConfig({ enableSound: elements.soundToggle.checked });
}

function handleAnimationChange() {
    const level = animationLevels[elements.animationSlider.value];
    configService.setConfig({ animationIntensity: level });
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

    event.preventDefault(); // Prevent page scroll

    const buttons = Array.from(elements.themeToggleButtons);
    const checkedButton = elements.themeToggle.querySelector('button[aria-checked="true"]');
    let currentIndex = buttons.indexOf(checkedButton);

    if (key === 'ArrowLeft') {
        currentIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    } else if (key === 'ArrowRight') {
        currentIndex = (currentIndex + 1) % buttons.length;
    }

    const newButton = buttons[currentIndex];
    newButton.focus(); // Move focus to the new button
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

export function init(appState) {
    elements = {
        soundToggle: document.getElementById('sound-toggle'),
        animationSlider: document.getElementById('animation-slider'),
        clearDataBtn: document.getElementById('clear-data-btn'),
        themeToggle: document.getElementById('theme-toggle-group'),
        themeToggleButtons: document.querySelectorAll('#theme-toggle-group button'),
    };

    loadSettings();

    elements.soundToggle.addEventListener('change', handleSoundToggle);
    elements.animationSlider.addEventListener('input', handleAnimationChange);
    elements.clearDataBtn.addEventListener('click', handleClearData);
    elements.themeToggle.addEventListener('click', handleThemeToggle);
    elements.themeToggle.addEventListener('keydown', handleThemeToggleKeydown);
}

export function destroy() {
    if (elements.soundToggle) elements.soundToggle.removeEventListener('change', handleSoundToggle);
    if (elements.animationSlider) elements.animationSlider.removeEventListener('input', handleAnimationChange);
    if (elements.clearDataBtn) elements.clearDataBtn.removeEventListener('click', handleClearData);
    if (elements.themeToggle) {
        elements.themeToggle.removeEventListener('click', handleThemeToggle);
        elements.themeToggle.removeEventListener('keydown', handleThemeToggleKeydown);
    }
    elements = {};
}