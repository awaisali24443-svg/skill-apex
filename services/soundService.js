// Create a single AudioContext to be reused
let audioCtx;

function getAudioContext() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) {
            console.error("Web Audio API is not supported in this browser.");
            audioCtx = null;
        }
    }
    return audioCtx;
}

// A simple sound player using the Web Audio API
function playTone(frequency, duration, type = 'sine', volume = 0.1, decay = true) {
    const context = getAudioContext();
    if (!context) return; // AudioContext not supported or failed to initialize

    try {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        
        gainNode.gain.setValueAtTime(volume, context.currentTime); 
        
        if (decay) {
            gainNode.gain.exponentialRampToValueAtTime(0.00001, context.currentTime + duration / 1000);
        }

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + duration / 1000);
    } catch (e) {
        console.error("Could not play sound:", e);
    }
}

const sounds = {
    'correct': () => playTone(600, 200, 'triangle'),
    'incorrect': () => playTone(200, 300, 'sawtooth'),
    'start': () => playTone(440, 150, 'sine'),
    'complete': () => {
        playTone(523.25, 150, 'sine'); // C5
        setTimeout(() => playTone(659.25, 150, 'sine'), 150); // E5
        setTimeout(() => playTone(783.99, 150, 'sine'), 300); // G5
    },
    'select': () => playTone(800, 50, 'triangle'),
    'click': () => playTone(900, 80, 'triangle', 0.05), // Soft, futuristic "ping"
};

/**
 * Plays a predefined sound effect.
 * @param {string} soundName - The name of the sound to play (e.g., 'correct', 'incorrect').
 */
export function playSound(soundName) {
    // Ensure user has interacted with the page before playing sound
    const context = getAudioContext();
    if (context && context.state === 'suspended') {
        context.resume();
    }
    
    if (sounds[soundName]) {
        sounds[soundName]();
    } else {
        console.warn(`Sound "${soundName}" not found.`);
    }
}