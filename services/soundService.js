
let configSvc;
let audioCtx = null;
let isInitialized = false;

/**
 * Initializes the audio context.
 */
function getContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    return audioCtx;
}

export function init(configService) {
    if (isInitialized) return;
    configSvc = configService;
    isInitialized = true;
}

function playTone(freq, type, duration, startTime = 0, volume = 0.1) {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime + startTime;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.1);
}

function playSuccessChime() {
    playTone(1046.50, 'sine', 0.15, 0, 0.2); 
    playTone(1318.51, 'sine', 0.3, 0.08, 0.2);
    playTone(2093.00, 'triangle', 0.1, 0.08, 0.05);
}

function playErrorThud() {
    const ctx = getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
}

function playPop() {
    const ctx = getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
}

function playFanfare() {
    const now = 0;
    playTone(523.25, 'square', 0.2, now, 0.1);       
    playTone(659.25, 'square', 0.2, now + 0.1, 0.1); 
    playTone(783.99, 'square', 0.2, now + 0.2, 0.1); 
    playTone(1046.50, 'square', 0.4, now + 0.3, 0.15); 
}

/**
 * Plays a sound effect.
 */
export function playSound(soundName) {
    if (navigator.vibrate) {
        try {
            switch (soundName) {
                case 'click': navigator.vibrate(5); break; 
                case 'correct': navigator.vibrate([50, 30, 50]); break;
                case 'incorrect': navigator.vibrate(100); break;
                case 'achievement': navigator.vibrate([50, 50, 50, 50, 100]); break;
                case 'finish': navigator.vibrate([50, 50, 100]); break;
            }
        } catch(e) {}
    }

    if (!configSvc) return;
    const { enableSound } = configSvc.getConfig();
    if (!enableSound) return;

    const ctx = getContext();
    
    // FIX: Only resume context if sound is requested, preventing startup warnings
    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }

    switch (soundName) {
        case 'click': playPop(); break;
        case 'hover': playTone(1200, 'sine', 0.01, 0, 0.02); break;
        case 'correct': playSuccessChime(); break;
        case 'incorrect': playErrorThud(); break;
        case 'start': 
            playTone(400, 'sine', 0.3, 0, 0.1);
            playTone(600, 'sine', 0.3, 0.1, 0.1);
            break;
        case 'finish':
        case 'achievement': playFanfare(); break;
        case 'flip':
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const now = ctx.currentTime;
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
    }
}
