let configSvc;
let sounds = {
    correct: null,
    incorrect: null,
};
let isInitialized = false;

/**
 * Loads the audio files into Audio objects.
 * @private
 */
function loadSounds() {
    try {
        sounds.correct = new Audio('/assets/sounds/correct.mp3');
        sounds.incorrect = new Audio('/assets/sounds/incorrect.mp3');
        sounds.correct.volume = 0.5;
        sounds.incorrect.volume = 0.5;
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
 * @param {'correct'|'incorrect'} soundName - The name of the sound to play.
 */
export function playSound(soundName) {
    const { enableSound } = configSvc.getConfig();
    if (enableSound && sounds[soundName]) {
        sounds[soundName].currentTime = 0;
        sounds[soundName].play().catch(e => console.error("Error playing sound:", e));
    }
}