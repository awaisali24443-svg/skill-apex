const THEMES = {
    'dark-cyber': {
        path: '/themes/theme-dark-cyber.css',
        color: '#0c0e1a'
    },
    'light-cyber': {
        path: '/themes/theme-light-cyber.css',
        color: '#f0f2f8'
    }
};

/**
 * Applies a specified theme to the application.
 * Updates the theme stylesheet link and the browser's theme-color meta tag.
 * @param {string} [themeName='dark-cyber'] - The name of the theme to apply (e.g., 'dark-cyber', 'light-cyber').
 */
export function applyTheme(themeName = 'dark-cyber') {
    let effectiveThemeName = themeName;
    let theme = THEMES[effectiveThemeName];

    if (!theme) {
        console.warn(`Theme "${themeName}" not found. Defaulting to dark-cyber.`);
        effectiveThemeName = 'dark-cyber';
        theme = THEMES[effectiveThemeName];
    }

    document.getElementById('theme-stylesheet')?.setAttribute('href', theme.path);
    document.getElementById('theme-color-meta')?.setAttribute('content', theme.color);
}
