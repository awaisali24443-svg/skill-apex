import * as progressService from '../../services/progressService.js';

console.log("Settings module loaded.");

const themes = [
    { value: 'google-ai-studio', text: 'AI Studio', colors: ['#8952ff', '#1e1f20'] },
    { value: 'carbon-mist', text: 'Carbon Mist', colors: ['#2dd4bf', '#1f1f1f'] },
    { value: 'neon-pulse', text: 'Neon Pulse', colors: ['#22d3ee', '#0f172a'] },
    { value: 'aurora-dawn', text: 'Aurora Dawn', colors: ['#f472b6', '#fef3c7'] },
    { value: 'space-alloy', text: 'Space Alloy', colors: ['#7dd3fc', '#334155'] },
    { value: 'techno-breeze', text: 'Techno Breeze', colors: ['#1d4ed8', '#f0f4f9'] },
    { value: 'midnight-glass', text: 'Midnight Glass', colors: ['#60a5fa', 'rgba(29, 44, 69, 0.7)'] },
    { value: 'quantum-fade', text: 'Quantum Fade', colors: ['#818cf8', '#f5f3ff'] },
    { value: 'ocean-core', text: 'Ocean Core', colors: ['#06b6d4', '#0e485b'] },
    { value: 'cyber-royale', text: 'Cyber Royale', colors: ['#facc15', '#1a1a1a'] },
    { value: 'digital-ice', text: 'Digital Ice', colors: ['#0ea5e9', '#ffffff'] },
    { value: 'royal-ember', text: 'Royal Ember', colors: ['#f59e0b', '#7a0929'] },
    { value: 'quantum-edge', text: 'Quantum Edge', colors: ['#00f7ff', '#111111'] },
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