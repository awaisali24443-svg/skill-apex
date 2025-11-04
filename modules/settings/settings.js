import * as progressService from '../../services/progressService.js';

console.log("Settings module loaded.");

const themes = [
    { value: 'google-ai-studio', text: 'AI Studio', colors: ['#8952ff', '#e3e3e3'] },
    { value: 'carbon-mist', text: 'Carbon Mist', colors: ['#2dd4bf', '#e5e7eb'] },
    { value: 'neon-pulse', text: 'Neon Pulse', colors: ['#22d3ee', '#f8fafc'] },
    { value: 'aurora-dawn', text: 'Aurora Dawn', colors: ['#f472b6', '#fef3c7'] },
    { value: 'space-alloy', text: 'Space Alloy', colors: ['#7dd3fc', '#f1f5f9'] },
    { value: 'techno-breeze', text: 'Techno Breeze', colors: ['#1d4ed8', '#e0e7ff'] },
    { value: 'midnight-glass', text: 'Midnight Glass', colors: ['#60a5fa', '#e0f2fe'] },
    { value: 'quantum-fade', text: 'Quantum Fade', colors: ['#818cf8', '#e0e7ff'] },
    { value: 'ocean-core', text: 'Ocean Core', colors: ['#06b6d4', '#ecfeff'] },
    { value: 'cyber-royale', text: 'Cyber Royale', colors: ['#facc15', '#f5f5f5'] },
    { value: 'digital-ice', text: 'Digital Ice', colors: ['#0ea5e9', '#f0f8ff'] },
    { value: 'royal-ember', text: 'Royal Ember', colors: ['#f59e0b', '#fef2f2'] },
    { value: 'quantum-edge', text: 'Quantum Edge', colors: ['#00f7ff', '#f0f0f0'] },
];

const themeGrid = document.getElementById('theme-grid');
const resetButton = document.getElementById('reset-progress-btn');
const appVersionEl = document.getElementById('app-version');

function setTheme(themeName) {
    const themeLink = document.getElementById('theme-link');
    if (themeLink) {
        themeLink.href = `/themes/${themeName}.css`;
        localStorage.setItem('theme', themeName);
    }
}

function updateActiveSwatch(themeName) {
    document.querySelectorAll('.theme-swatch').forEach(swatch => {
        swatch.classList.toggle('active', swatch.dataset.theme === themeName);
    });
}

function renderThemeSwatches() {
    if (!themeGrid) return;
    
    themeGrid.innerHTML = themes.map(theme => `
        <div class="theme-swatch" data-theme="${theme.value}" role="button" aria-label="Select ${theme.text} theme" tabindex="0">
            <div class="swatch-colors">
                <div class="swatch-color" style="background-color: ${theme.colors[0]}"></div>
                <div class="swatch-color" style="background-color: ${theme.colors[1]}"></div>
            </div>
            <span>${theme.text}</span>
        </div>
    `).join('');

    const currentTheme = localStorage.getItem('theme') || 'carbon-mist';
    updateActiveSwatch(currentTheme);
}

function handleThemeSelection(e) {
    const swatch = e.target.closest('.theme-swatch');
    if (!swatch) return;

    const themeName = swatch.dataset.theme;
    setTheme(themeName);
    updateActiveSwatch(themeName);
}

function handleResetProgress() {
    const isConfirmed = window.confirm("Are you sure you want to reset all your progress? This action cannot be undone.");
    if (isConfirmed) {
        progressService.resetProgress();
        alert("Your progress has been reset. The page will now reload.");
        // Reload to ensure all components (like progress screen) reflect the change.
        window.location.reload();
    }
}

function init() {
    renderThemeSwatches();

    if (themeGrid) {
        themeGrid.addEventListener('click', handleThemeSelection);
    }

    if (resetButton) {
        resetButton.addEventListener('click', handleResetProgress);
    }

    // In a real build process, you could fetch this from package.json
    // For now, we'll keep it static.
    if (appVersionEl) {
        appVersionEl.textContent = "1.1.0";
    }
}

init();