export const themes = [
    { id: 'quantum-blue', name: 'Quantum Blue', colors: ['#00d2ff', '#3a7bd5'] },
    { id: 'cyber-aurora', name: 'Cyber Aurora', colors: ['#7B2FF7', '#00F5D4'] },
    { id: 'solar-flare', name: 'Solar Flare', colors: ['#FFD700', '#FF4500'] },
    { id: 'neural-frost', name: 'Neural Frost', colors: ['#E0EFFF', '#B2FEFA'] },
    { id: 'emerald-circuit', name: 'Emerald Circuit', colors: ['#00FF7F', '#373B44'] },
    { id: 'obsidian-matrix', name: 'Obsidian Matrix', colors: ['#000000', '#39FF14'] },
    { id: 'prism-halo', name: 'Prism Halo', colors: ['#FF00FF', '#00FFFF'] },
    { id: 'crimson-core', name: 'Crimson Core', colors: ['#DC143C', '#4F4F4F'] },
    { id: 'eclipse-void', name: 'Eclipse Void', colors: ['#FFD700', '#2C3E50'] },
    { id: 'celestial-white', name: 'Celestial White', colors: ['#F0F2F5', '#C9D6FF'] },
];

const themeLink = document.getElementById('theme-link');
const body = document.body;

function applyTheme(themeId, fromAI = false) {
    if (!themeLink) {
        console.error("Theme link element with id 'theme-link' not found!");
        return;
    }
    const selectedTheme = themes.find(t => t.id === themeId);
    if (!selectedTheme) {
        console.warn(`Theme "${themeId}" not found. Applying default.`);
        themeId = 'quantum-blue'; // Fallback to a default
    }

    body.classList.add('theme-transitioning');
    
    themeLink.href = `/themes/theme-${themeId}.css`;

    localStorage.setItem('selected-theme', themeId);
    
    if (window.showToast) {
        const message = fromAI 
            ? `🎨 AI suggests ${selectedTheme.name} for this time of day!`
            : `🎨 Switched to ${selectedTheme.name}`;
        window.showToast(message);
    }


    themeLink.onload = () => {
        setTimeout(() => {
            body.classList.remove('theme-transitioning');
        }, 50);
    };
}

function aiSuggestTheme() {
    const hour = new Date().getHours();
    let themeId = 'cyber-aurora'; // Default (evening)

    if (hour >= 5 && hour < 12) { // Morning
        themeId = 'celestial-white';
    } else if (hour >= 18 || hour < 5) { // Night
        themeId = 'obsidian-matrix';
    }
    
    applyTheme(themeId, true);
    return themeId;
}

function initTheme() {
    const savedTheme = localStorage.getItem('selected-theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    }
}

export { applyTheme, initTheme, aiSuggestTheme };