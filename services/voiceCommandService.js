
import { showToast } from './toastService.js';
import * as learningPathService from './learningPathService.js';
import * as stateService from './stateService.js';

let recognition;
let isListening = false;

export function isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function init() {
    // Feature check to prevent crashes on unsupported browsers
    if (!isSupported()) {
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
            if (event.results.length > 0) {
                const command = event.results[0][0].transcript.toLowerCase().trim();
                console.log('Voice Command:', command);
                processCommand(command);
            }
        };

        recognition.onerror = (event) => {
            console.warn('Voice Command Error:', event.error);
            setListeningState(false);
            if (event.error === 'not-allowed') {
                showToast('Microphone permission denied.', 'error');
            } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
                showToast('Voice command failed. Try again.', 'error');
            }
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
        try {
            recognition.stop();
        } catch(e) { /* ignore if already stopped */ }
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
    
    // Update FAB visual state if it exists
    const fab = document.getElementById('voice-mic-btn');
    if (fab) {
        if (active) fab.classList.add('active');
        else fab.classList.remove('active');
    }
}

function processCommand(command) {
    // --- 1. Navigation Commands ---
    if (command.includes('home') || command.includes('dashboard')) {
        window.location.hash = '/';
        showToast('Navigating Home');
        return;
    } else if (command.includes('profile') || command.includes('stats')) {
        window.location.hash = '/profile';
        showToast('Navigating to Profile');
        return;
    } else if (command.includes('history') || command.includes('log')) {
        window.location.hash = '/history';
        showToast('Navigating to History');
        return;
    } else if (command.includes('library')) {
        window.location.hash = '/library';
        showToast('Navigating to Library');
        return;
    } else if (command.includes('journey') || command.includes('topics') || command.includes('explore')) {
        window.location.hash = '/topics';
        showToast('Navigating to Journeys');
        return;
    } else if (command.includes('back') || command.includes('go back')) {
        window.history.back();
        showToast('Going Back');
        return;
    } else if (command.includes('settings') || command.includes('config')) {
        window.location.hash = '/settings';
        showToast('Navigating to Settings');
        return;
    }

    // --- 2. Intelligent Action Commands (Start Level / Resume) ---
    if (command.includes('start') || command.includes('resume') || command.includes('continue') || command.includes('play') || command.includes('begin') || command.includes('launch')) {
        const journeys = learningPathService.getAllJourneys();
        
        if (journeys.length === 0) {
            showToast("No active journeys found. Say 'Explore' to create one.", "error");
            return;
        }

        const matchedJourney = journeys.find(j => {
            const topicKeywords = j.goal.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(' ');
            return topicKeywords.some(keyword => keyword.length > 2 && command.includes(keyword));
        });

        if (matchedJourney) {
            launchLevel(matchedJourney);
            return;
        }

        if (command.includes('level') || command.includes('mission') || command.includes('resume') || command.includes('continue') || command.includes('journey')) {
            launchLevel(journeys[0]);
            return;
        }
    }

    showToast(`Command not recognized: "${command}"`, 'info');
}

function launchLevel(journey) {
    if (!journey) return;

    if (journey.currentLevel > journey.totalLevels) {
        showToast(`Journey "${journey.goal}" is already complete!`, 'success');
        return;
    }

    showToast(`Resuming ${journey.goal}: Level ${journey.currentLevel}`, 'success');
    
    const isBoss = (journey.currentLevel % 50 === 0) || (journey.currentLevel === journey.totalLevels);
    
    stateService.setNavigationContext({
        topic: journey.goal,
        level: journey.currentLevel,
        journeyId: journey.id,
        totalLevels: journey.totalLevels,
        isBoss: isBoss
    });
    
    window.location.hash = '#/level';
}
