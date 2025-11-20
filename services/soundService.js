let configSvc;
let sounds = {
    correct: null,
    incorrect: null,
    click: null,
    start: null,
    finish: null,
    hover: null,
    achievement: null,
    flip: null,
};
let isInitialized = false;

/**
 * Loads the audio files into Audio objects.
 * @private
 */
function loadSounds() {
    try {
        sounds.correct = new Audio('assets/sounds/correct.mp3');
        sounds.incorrect = new Audio('assets/sounds/incorrect.mp3');
        sounds.click = new Audio('assets/sounds/click.mp3');
        sounds.start = new Audio('assets/sounds/start.mp3');
        sounds.finish = new Audio('assets/sounds/finish.mp3');
        sounds.hover = new Audio('assets/sounds/hover.mp3');
        sounds.achievement = new Audio('assets/sounds/achievement.mp3');
        sounds.flip = new Audio('assets/sounds/flip.mp3');

        // Set varying volumes for a better soundscape
        if(sounds.correct) sounds.correct.volume = 0.5;
        if(sounds.incorrect) sounds.incorrect.volume = 0.5;
        if(sounds.click) sounds.click.volume = 0.3;
        if(sounds.start) sounds.start.volume = 0.5;
        if(sounds.finish) sounds.finish.volume = 0.5;
        if(sounds.hover) sounds.hover.volume = 0.15; // very subtle
        if(sounds.achievement) sounds.achievement.volume = 0.7; // loud and proud
        if(sounds.flip) sounds.flip.volume = 0.4;

    } catch(e) {
        console.error("Failed to load sounds", e);
    }
}

/**
 * Initializes the sound service.
 * @param {object} configService - A reference to the configService module.
 */
export function init(configService) {
    if (isInitialized) return;
    configSvc = configService;
    loadSounds();
    isInitialized = true;
}

/**
 * Plays a sound if sound effects are enabled in the settings.
 * Also triggers haptic feedback if available.
 * @param {'correct'|'incorrect'|'click'|'start'|'finish'|'hover'|'achievement'|'flip'} soundName - The name of the sound to play.
 */
export function playSound(soundName) {
    const { enableSound } = configSvc.getConfig();
    
    // Haptic Feedback
    if (navigator.vibrate) {
        switch (soundName) {
            case 'click':
                navigator.vibrate(10); // Light tap
                break;
            case 'hover':
                // No vibrate on hover, too annoying
                break;
            case 'correct':
                navigator.vibrate([50, 30, 50]); // Double tap
                break;
            case 'incorrect':
                navigator.vibrate(200); // Heavy buzz
                break;
            case 'achievement':
                navigator.vibrate([100, 50, 100, 50, 100]); // Triple tap
                break;
            case 'start':
            case 'finish':
                navigator.vibrate(50);
                break;
        }
    }

    // Audio
    if (enableSound && sounds[soundName]) {
        sounds[soundName].currentTime = 0;
        sounds[soundName].play().catch(e => console.error("Error playing sound:", e));
    }
}