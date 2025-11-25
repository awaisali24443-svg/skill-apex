
import * as modalService from './modalService.js';
import { showToast } from './toastService.js';

let recognition;
let isListening = false;
let isSupported = false;

const COMMANDS = {
    'home': () => window.location.hash = '/',
    'dashboard': () => window.location.hash = '/',
    'topics': () => window.location.hash = '/topics',
    'explore': () => window.location.hash = '/topics',
    'journeys': () => window.location.hash = '/topics',
    'profile': () => window.location.hash = '/profile',
    'stats': () => window.location.hash = '/profile',
    'progress': () => window.location.hash = '/profile',
    'library': () => window.location.hash = '/library',
    'vault': () => window.location.hash = '/library',
    'saved': () => window.location.hash = '/library',
    'settings': () => window.location.hash = '/settings',
    'config': () => window.location.hash = '/settings',
    'help': () => document.getElementById('help-modal').style.display = 'flex',
    'guide': () => document.getElementById('help-modal').style.display = 'flex',
    'back': () => window.history.back(),
    'go back': () => window.history.back(),
    'return': () => window.history.back(),
};

export function init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('Web Speech API not supported in this browser.');
        return;
    }
    isSupported = true;

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript.trim().toLowerCase();
        
        console.log('Voice Command Heard:', text);
        processCommand(text);
    };

    recognition.onend = () => {
        if (isListening) {
            try {
                recognition.start(); // Auto-restart for continuous listening
            } catch(e) {
                console.log('Recognition restart prevented', e);
                isListening = false;
                updateUI();
            }
        }
    };

    recognition.onerror = (event) => {
        if (event.error === 'no-speech') return;
        console.error('Voice recognition error', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            isListening = false;
            showToast('Microphone access denied.', 'error');
            updateUI();
        }
    };
}

function processCommand(transcript) {
    // Simple keyword matching
    let matched = false;
    
    // Check exact matches or "go to [command]"
    for (const [key, action] of Object.entries(COMMANDS)) {
        if (transcript.includes(key)) {
            showToast(`Voice: Executing "${key.toUpperCase()}"`, 'info', 1500);
            action();
            matched = true;
            break; // Stop after first match
        }
    }

    if (!matched) {
        // Optional: visual feedback for unrecognized command
        // showToast(`Unrecognized: "${transcript}"`, 'info', 1000);
    }
}

export function toggleListening() {
    if (!isSupported) {
        showToast('Voice control not supported in this browser.', 'error');
        return;
    }

    if (isListening) {
        stop();
    } else {
        start();
    }
}

function start() {
    if (!recognition) init();
    try {
        recognition.start();
        isListening = true;
        showToast('Voice Control Active', 'success');
        updateUI();
    } catch (e) {
        console.error(e);
    }
}

function stop() {
    if (recognition) {
        isListening = false;
        recognition.stop();
        showToast('Voice Control Paused', 'info');
        updateUI();
    }
}

function updateUI() {
    const btn = document.getElementById('voice-nav-toggle');
    const indicator = document.getElementById('voice-indicator');
    
    if (btn) {
        if (isListening) {
            btn.classList.add('active');
            btn.querySelector('.text').textContent = 'Listening...';
        } else {
            btn.classList.remove('active');
            btn.querySelector('.text').textContent = 'Voice Nav';
        }
    }

    if (indicator) {
        indicator.style.display = isListening ? 'flex' : 'none';
    }
}

export function isVoiceActive() {
    return isListening;
}
