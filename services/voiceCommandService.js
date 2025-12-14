
import { showToast } from './toastService.js';
import * as learningPathService from './learningPathService.js';
import * as stateService from './stateService.js';

let recognition;
let isListening = false;

export function isSupported() {
    return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
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
            const command = event.results[0][0].transcript.toLowerCase().trim();
            console.log('Voice Command:', command);
            processCommand(command);
        };

        recognition.onerror = (event) => {
            console.warn('Voice Command Error:', event.error);
            // Don't show toast for 'no-speech' as it's annoying
            if (event.error !== 'no-speech') {
                showToast('Voice command failed. Try again.', 'error');
            }
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
    // Matches: "Start level...", "Resume...", "Play...", "Begin...", "Launch..."
    if (command.includes('start') || command.includes('resume') || command.includes('continue') || command.includes('play') || command.includes('begin') || command.includes('launch')) {
        const journeys = learningPathService.getAllJourneys();
        
        if (journeys.length === 0) {
            showToast("No active journeys found. Say 'Explore' to create one.", "error");
            return;
        }

        // Strategy A: Specific Topic Matching
        // We look for words in the command that match part of a journey's goal.
        // e.g. Command "Resume Cyber Security" matches Journey "Cybersecurity & Ethical Hacking" via the word "Cyber"
        const matchedJourney = journeys.find(j => {
            // Split journey goal into keywords (remove symbols)
            const topicKeywords = j.goal.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(' ');
            
            // Check if any significant keyword (len > 2) from the topic exists in the spoken command
            return topicKeywords.some(keyword => keyword.length > 2 && command.includes(keyword));
        });

        if (matchedJourney) {
            launchLevel(matchedJourney);
            return;
        }

        // Strategy B: Generic "Resume" (Most Recent)
        // If command is generic ("start level", "resume mission"), pick the most recent one (index 0)
        // But only if we didn't find a specific match and the user didn't specify a topic name that we failed to catch.
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
    
    // Determine Boss Status (Every 50 levels is a chapter boss)
    const isBoss = (journey.currentLevel % 50 === 0) || (journey.currentLevel === journey.totalLevels);
    
    // Set Context for Game Level
    stateService.setNavigationContext({
        topic: journey.goal,
        level: journey.currentLevel,
        journeyId: journey.id,
        totalLevels: journey.totalLevels,
        isBoss: isBoss
    });
    
    // Direct Deep Link to Gameplay
    window.location.hash = '#/level';
}
