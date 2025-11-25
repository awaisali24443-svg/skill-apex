
import { showToast } from './toastService.js';

let recognition;
let isListening = false;

export function init() {
    // Feature check to prevent crashes on unsupported browsers
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn("Voice Command: Speech Recognition API not supported in this browser.");
        return;
    }

    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const command = event.results[0][0].transcript.toLowerCase().trim();
            console.log('Voice Command:', command);
            processCommand(command);
        };

        recognition.onerror = (event) => {
            console.warn('Voice Command Error:', event.error);
            setListeningState(false);
        };

        recognition.onend = () => {
            setListeningState(false);
        };
        
        console.log("Voice Command Service initialized successfully.");
    } catch (e) {
        console.error("Failed to initialize Voice Command Service:", e);
    }
}

export function toggleListening() {
    if (!recognition) {
        showToast("Voice control not supported on this device.", "error");
        return;
    }

    if (isListening) {
        recognition.stop();
        setListeningState(false);
    } else {
        try {
            recognition.start();
            setListeningState(true);
            showToast('Listening...', 'info');
        } catch(e) {
            console.error("Error starting recognition:", e);
            setListeningState(false);
        }
    }
}

function setListeningState(active) {
    isListening = active;
    const indicator = document.getElementById('voice-indicator');
    if (indicator) {
        indicator.style.display = active ? 'flex' : 'none';
        if(active) indicator.classList.add('pulse');
        else indicator.classList.remove('pulse');
    }
}

function processCommand(command) {
    if (command.includes('home') || command.includes('dashboard')) {
        window.location.hash = '/';
        showToast('Navigating Home');
    } else if (command.includes('profile') || command.includes('stats')) {
        window.location.hash = '/profile';
        showToast('Navigating to Profile');
    } else if (command.includes('history') || command.includes('log')) {
        window.location.hash = '/history';
        showToast('Navigating to History');
    } else if (command.includes('journey') || command.includes('topics') || command.includes('explore')) {
        window.location.hash = '/topics';
        showToast('Navigating to Journeys');
    } else if (command.includes('back') || command.includes('go back')) {
        window.history.back();
        showToast('Going Back');
    } else if (command.includes('settings') || command.includes('config')) {
        window.location.hash = '/settings';
        showToast('Navigating to Settings');
    } else {
        showToast(`Command not recognized: "${command}"`, 'info');
    }
}
