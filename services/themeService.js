
const THEMES = {
    'light-cyber': {
        path: '/themes/theme-light-cyber.css',
        color: '#f8f9fa'
    },
    'light-solar': {
        path: '/themes/theme-light-solar.css',
        color: '#fffbf5'
    },
    'dark': {
        path: '/themes/theme-dark.css',
        color: '#101410'
    },
    'dark-cyber': {
        path: '/themes/theme-dark-cyber.css',
        color: '#0c0e1a'
    },
    'dark-arcane': {
        path: '/themes/theme-dark-arcane.css',
        color: '#1a143b'
    },
    'dark-nebula': {
        path: '/themes/theme-dark-nebula.css',
        color: '#0d1117'
    },
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
    
    optimizeForHardware();
}

/**
 * Detects low-spec devices and disables expensive CSS filters (blur/shadows)
 * to maintain 60 FPS.
 */
function optimizeForHardware() {
    // If logical processors < 4, it's likely a budget device or battery saver mode
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
        document.body.classList.add('low-perf');
        console.log("Performance Mode: Low (Backdrop filters disabled)");
    } else {
        document.body.classList.remove('low-perf');
    }
}

/**
 * Applies the animation intensity setting by adding a class to the body.
 * @param {string} level - The animation level ('off', 'subtle', 'full').
 */
export function applyAnimationSetting(level = 'full') {
    const body = document.body;
    body.classList.remove('animations-off', 'animations-subtle');
    if (level === 'off') {
        body.classList.add('animations-off');
    } else if (level === 'subtle') {
        body.classList.add('animations-subtle');
    }
}
