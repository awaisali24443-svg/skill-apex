
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
 * CORE SYNTH: Plays a tone with an envelope (Attack/Decay).
 */
function playTone(freq, type, duration, startTime = 0, volume = 0.1) {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime + startTime;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    // ADSR-like Envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01); // Fast Attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Smooth Decay

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.1);
}

/**
 * UI CLICK: High-tech, crisp "Tick".
 * Replaces the old low-fi pop.
 */
function playClick() {
    const ctx = getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Very fast pitch drop for a percussive "click" feel
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);

    // Short, snappy envelope
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.06);
}

/**
 * SUCCESS: A rich "Glassy" Major Triad.
 * Pitch shifts upwards with combo count.
 */
function playSuccessChime(combo = 0) {
    const ctx = getContext();
    const now = ctx.currentTime;
    
    // Pitch Logic: Root A (440) -> shifts up slightly with combo
    // Cap pitch shift at ~1 octave (combo 10)
    const shift = Math.min(combo, 12) * 100; 
    const root = 880 + shift; 

    // Chord Structure: Root, Major 3rd, Perfect 5th
    const frequencies = [root, root * 1.25, root * 1.5];
    
    frequencies.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        // Sine for body, Triangle for sparkle on top note
        osc.type = i === 2 ? 'triangle' : 'sine'; 
        osc.frequency.setValueAtTime(f, now);
        
        gain.gain.setValueAtTime(0, now);
        // Staggered attack for a strummed/arpeggiated feel
        const attackTime = 0.02 + (i * 0.03);
        gain.gain.linearRampToValueAtTime(0.08, now + attackTime);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6); // Long "ring" out

        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.7);
    });
}

/**
 * ERROR: A soft, filtered "Thud".
 * Less harsh than a buzzer, more like hitting a wall.
 */
function playErrorThud() {
    const ctx = getContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter(); // Filter for warmth
    
    // Sawtooth gives texture, Lowpass filter takes away the harsh buzz
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.25); // Pitch dive

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now); // Cut off highs

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.3);
}

/**
 * LEVEL UP: A triumphant Major 7th Arpeggio.
 * Fast, exciting, and rewarding.
 */
function playFanfare() {
    // C Major 7 Arpeggio sequence (C5, E5, G5, B5, C6)
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.50];
    
    notes.forEach((freq, i) => {
        // Fast sequence
        playTone(freq, 'triangle', 0.4, i * 0.08, 0.1);
    });
    
    // Final resolving chord swell
    setTimeout(() => {
        playTone(523.25, 'sine', 1.0, 0, 0.05); // Root
        playTone(783.99, 'sine', 1.0, 0, 0.05); // 5th
        playTone(1046.50, 'sine', 1.0, 0, 0.05); // Octave
    }, 400);
}

/**
 * START: A futuristic "Turbine Spool-up".
 * Signals the system is online.
 */
function playStartSound() {
    const ctx = getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Frequency sweep up
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.35);
}

/**
 * FLIP: A quick "Air Swish".
 */
function playFlipSound() {
    const ctx = getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
}

/**
 * Main Public Interface
 * @param {'correct'|'incorrect'|'click'|'start'|'finish'|'hover'|'achievement'|'flip'} soundName
 * @param {number} [param=0] - Optional parameter (e.g. Combo count)
 */
export function playSound(soundName, param = 0) {
    // 1. Haptic Feedback (Always run if available and supported)
    if (navigator.vibrate) {
        try {
            switch (soundName) {
                case 'click': navigator.vibrate(5); break; 
                case 'correct': navigator.vibrate([10, 30, 10]); break; // Crisp double tap
                case 'incorrect': navigator.vibrate(50); break; // Heavy tap
                case 'achievement': navigator.vibrate([50, 50, 50, 50, 100]); break;
                case 'finish': navigator.vibrate([30, 30, 50]); break;
            }
        } catch(e) {}
    }

    // 2. Audio Feedback Logic
    if (!configSvc) return; // Safety check
    const { enableSound } = configSvc.getConfig();
    if (!enableSound) return;

    const ctx = getContext();
    // Ensure context is running (browsers auto-suspend it until interaction)
    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }

    switch (soundName) {
        case 'click':
            playClick();
            break;

        case 'hover':
            // Extremely subtle high-pitch tick for hover
            playTone(1800, 'sine', 0.02, 0, 0.015);
            break;

        case 'correct':
            playSuccessChime(param);
            break;

        case 'incorrect':
            playErrorThud();
            break;

        case 'start':
            playStartSound();
            break;

        case 'finish':
        case 'achievement':
            playFanfare();
            break;

        case 'flip':
            playFlipSound();
            break;
    }
}
