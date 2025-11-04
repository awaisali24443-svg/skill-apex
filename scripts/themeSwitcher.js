import { themes, applyTheme, initTheme } from './themeEngine.js';

function createSwitcher() {
    const switcherHTML = `
        <div id="theme-switcher-container">
            <button id="theme-switcher-toggle" aria-label="Open theme switcher" title="Change Theme">
                🎨
            </button>
            <div id="theme-switcher-panel" class="hidden">
                <h3>Select Theme</h3>
                <div id="theme-options">
                    ${themes.map(theme => `
                        <div class="theme-option" data-theme-id="${theme.id}" title="${theme.name}" role="button" tabindex="0">
                            <div class="theme-preview" style="background: linear-gradient(45deg, ${theme.colors[0]}, ${theme.colors[1]})"></div>
                            <span>${theme.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', switcherHTML);

    const toggleBtn = document.getElementById('theme-switcher-toggle');
    const panel = document.getElementById('theme-switcher-panel');
    const container = document.getElementById('theme-switcher-container');
    const options = document.querySelectorAll('.theme-option');

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('hidden');
    });

    // Close panel if clicking outside of it
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            panel.classList.add('hidden');
        }
    });

    options.forEach(option => {
        const selectTheme = () => {
             const themeId = option.dataset.themeId;
            applyTheme(themeId);
            // Optionally close panel on selection
            // panel.classList.add('hidden');
        };

        option.addEventListener('click', selectTheme);
        option.addEventListener('keydown', (e) => {
            if(e.key === 'Enter' || e.key === ' ') {
                selectTheme();
            }
        });
    });
}

// Initialize the theme from localStorage, then create the UI
initTheme();
createSwitcher();
