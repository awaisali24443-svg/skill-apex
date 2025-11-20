
let configSvc;
let audioCtx = null;
let isInitialized = false;

/**
 * Initializes the audio context.
 * Note: Browsers require user interaction before AudioContext can run.
 */
function getContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    return audioCtx;
}

/**
 * Initializes the sound service.
 * @param {object} configService - A reference to the configService module.
 */
export function init(configService) {
    if (isInitialized) return;
    configSvc = configService;
    isInitialized = true;
}

/**
 * Plays a synthesized tone.
 * @param {number} freq - Frequency in Hz.
 * @param {string} type - Oscillator type (sine, square, sawtooth, triangle).
 * @param {number} duration - Duration in seconds.
 * @param {number} startTime - Delay before starting.
 * @param {number} volume - Volume level (0-1).
 */
function playTone(freq, type, duration, startTime = 0, volume = 0.1) {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

    // Envelope to prevent clicking
    gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + startTime);
    osc.stop(ctx.currentTime + startTime + duration);
}

/**
 * Plays a frequency sweep (slide).
 */
function playSweep(startFreq, endFreq, duration, type = 'sine', volume = 0.1) {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
}

/**
 * Plays a sound effect.
 * @param {'correct'|'incorrect'|'click'|'start'|'finish'|'hover'|'achievement'|'flip'} soundName
 */
export function playSound(soundName) {
    // 1. Haptic Feedback (Always run if available, independent of sound setting)
    if (navigator.vibrate) {
        switch (soundName) {
            case 'click': navigator.vibrate(5); break; // Extremely light tap
            case 'correct': navigator.vibrate([50, 30, 50]); break;
            case 'incorrect': navigator.vibrate(150); break;
            case 'achievement': navigator.vibrate([50, 50, 50, 50, 100]); break;
            case 'start': navigator.vibrate(20); break;
            case 'finish': navigator.vibrate(50); break;
        }
    }

    // 2. Audio Feedback
    const { enableSound } = configSvc.getConfig();
    if (!enableSound) return;

    const ctx = getContext();
    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }

    switch (soundName) {
        case 'click':
            // High, short "tick"
            playTone(800, 'sine', 0.05, 0, 0.05);
            break;

        case 'hover':
            // Very subtle "pop"
            playTone(400, 'triangle', 0.03, 0, 0.02);
            break;

        case 'correct':
            // Major 3rd "Ding-Dong"
            playTone(523.25, 'sine', 0.3, 0, 0.1); // C5
            playTone(659.25, 'sine', 0.4, 0.1, 0.1); // E5
            break;

        case 'incorrect':
            // Low "Buzz"
            playTone(150, 'sawtooth', 0.4, 0, 0.08);
            playTone(145, 'sawtooth', 0.4, 0.05, 0.08); // Dissonance
            break;

        case 'start':
            // "Power Up" Sweep
            playSweep(200, 800, 0.3, 'sine', 0.1);
            break;

        case 'finish':
            // Major Triad Arpeggio
            playTone(523.25, 'sine', 0.4, 0, 0.1);   // C5
            playTone(659.25, 'sine', 0.4, 0.1, 0.1); // E5
            playTone(783.99, 'sine', 0.6, 0.2, 0.1); // G5
            break;

        case 'achievement':
            // Fast energetic sequence
            playTone(523.25, 'square', 0.1, 0, 0.05);
            playTone(659.25, 'square', 0.1, 0.08, 0.05);
            playTone(783.99, 'square', 0.1, 0.16, 0.05);
            playTone(1046.50, 'square', 0.4, 0.24, 0.05); // C6
            break;

        case 'flip':
            // Quick low sweep "Swish"
            playSweep(300, 100, 0.15, 'triangle', 0.05);
            break;
    }
}
