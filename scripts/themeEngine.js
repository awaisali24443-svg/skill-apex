export const themes = [
    { id: 'quantum-blue', name: 'Quantum Blue', colors: ['#00d2ff', '#3a7bd5'] },
    { id: 'cyber-aurora', name: 'Cyber Aurora', colors: ['#7B2FF7', '#00F5D4'] },
    { id: 'solar-flare', name: 'Solar Flare', colors: ['#FFD700', '#FF4500'] },
    { id: 'neural-frost', name: 'Neural Frost', colors: ['#E0EFFF', '#B2FEFA'] },
    { id: 'emerald-circuit', name: 'Emerald Circuit', colors: ['#00FF7F', '#373B44'] },
    { id: 'obsidian-matrix', name: 'Obsidian Matrix', colors: ['#39FF14', '#000000'] },
    { id: 'prism-halo', name: 'Prism Halo', colors: ['#FF00FF', '#00FFFF'] },
    { id: 'crimson-core', name: 'Crimson Core', colors: ['#DC143C', '#4F4F4F'] },
    { id: 'eclipse-void', name: 'Eclipse Void', colors: ['#FFD700', '#2C3E50'] },
    { id: 'celestial-white', name: 'Celestial White', colors: ['#F0F2F5', '#C9D6FF'] },
];

const themeLink = document.getElementById('theme-link');
const body = document.body;

function applyTheme(themeId) {
    if (!themeLink) {
        console.error("Theme link element with id 'theme-link' not found!");
        return;
    }
    const selectedTheme = themes.find(t => t.id === themeId);
    if (!selectedTheme) {
        console.warn(`Theme "${themeId}" not found. Applying default.`);
        themeId = 'quantum-blue'; // Fallback to a default
    }

    // Add a class to the body to pause CSS transitions during the switch
    body.classList.add('theme-transitioning');
    
    themeLink.href = `/themes/theme-${themeId}.css`;

    localStorage.setItem('selected-theme', themeId);

    // Remove the transition-pausing class after the new stylesheet has loaded
    themeLink.onload = () => {
        // A small timeout ensures the browser has rendered the new styles
        setTimeout(() => {
            body.classList.remove('theme-transitioning');
        }, 50);
    };
}

function initTheme() {
    const savedTheme = localStorage.getItem('selected-theme');
    // If a theme is saved in localStorage, apply it. Otherwise, the HTML default is used.
    if (savedTheme) {
        applyTheme(savedTheme);
    }
}

export { applyTheme, initTheme };
