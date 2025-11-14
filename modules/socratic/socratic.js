import * as apiService from '../../services/apiService.js';
import * as learningPathService from '../../services/learningPathService.js';
import { showToast } from '../../services/toastService.js';
import * as soundService from '../../services/soundService.js';

const STATE = {
    IDLE: 'IDLE',
    THINKING: 'THINKING',
    SPEAKING: 'SPEAKING',
    LISTENING: 'LISTENING',
    ENDED: 'ENDED',
};

let currentState = STATE.THINKING;
let elements = {};
let chatHistory = [];
let socraticContext = {};

// --- UI & State Updates ---

function updateUI(newState, message = '') {
    currentState = newState;
    elements.orb.className = 'orb'; // Reset classes

    switch (currentState) {
        case STATE.THINKING:
            elements.status.textContent = 'AI is thinking...';
            elements.orb.classList.add('thinking');
            elements.input.disabled = true;
            elements.submitBtn.disabled = true;
            break;
        case STATE.LISTENING:
            elements.status.textContent = 'Ready for your response';
            elements.orb.classList.add('listening');
            elements.input.disabled = false;
            elements.submitBtn.disabled = false;
            elements.input.focus();
            break;
        case STATE.ENDED:
            elements.status.textContent = 'Session complete';
            elements.inputContainer.style.display = 'none';
            elements.conclusionContainer.style.display = 'block';
            break;
    }
}

function addMessage(text, role) {
    if (!text.trim()) return;
    const entry = document.createElement('div');
    entry.className = `chat-entry ${role}`;
    entry.textContent = text;
    elements.log.prepend(entry);
    soundService.playSound(role === 'user' ? 'click' : 'start');
}

// --- Core Conversation Logic ---

async function sendMessage(userMessage = null) {
    if (userMessage) {
        addMessage(userMessage, 'user');
        chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });
    }
    
    updateUI(STATE.THINKING);

    try {
        const response = await apiService.sendSocraticMessage({
            summary: socraticContext.summary,
            history: chatHistory,
        });

        handleAiResponse(response);
    } catch (error) {
        showToast(error.message || 'An error occurred.', 'error');
        endSession({
            assessment: 'Sorry, I encountered an error and cannot continue this session.',
            passed: false,
        });
    }
}

function handleAiResponse(response) {
    if (response.nextQuestion) {
        addMessage(response.nextQuestion, 'model');
        chatHistory.push({ role: 'model', parts: [{ text: response.nextQuestion }] });
    }

    if (response.isComplete) {
        endSession(response);
    } else {
        updateUI(STATE.LISTENING);
    }
}

function endSession({ assessment, passed }) {
    updateUI(STATE.ENDED);
    const passIcon = passed ? 'check-circle' : 'x-circle';

    const assessmentHTML = `
        <div class="assessment-card ${passed ? 'passed' : 'failed'}">
            <h3>
                <svg class="icon" width="24" height="24"><use href="/assets/icons/feather-sprite.svg#${passIcon}"/></svg>
                ${passed ? 'Great Job!' : 'Good Effort!'}
            </h3>
            <p>${assessment}</p>
        </div>
        <div class="conclusion-actions">
            <a href="/#/learning-path/${socraticContext.learningPathId}" class="btn ${passed ? 'btn-primary' : ''}">
                ${passed ? 'Continue Journey' : 'Review Lesson'}
            </a>
        </div>
    `;
    elements.conclusionContainer.innerHTML = assessmentHTML;

    if (passed) {
        soundService.playSound('finish');
        showToast('Level passed! Well done.');
        learningPathService.recordStepScore(socraticContext.learningPathId, socraticContext.learningPathStepIndex, 1, 1); // Record a "pass"
        learningPathService.completeStep(socraticContext.learningPathId);
    } else {
        soundService.playSound('incorrect');
        showToast('Keep practicing! You\'ll get it.');
        learningPathService.recordStepScore(socraticContext.learningPathId, socraticContext.learningPathStepIndex, 0, 1); // Record a "fail"
    }
}


function handleFormSubmit(event) {
    event.preventDefault();
    const userMessage = elements.input.value.trim();
    if (userMessage && currentState === STATE.LISTENING) {
        sendMessage(userMessage);
        elements.input.value = '';
    }
}


// --- Module Lifecycle ---

export function init(appState) {
    socraticContext = appState.context.socraticContext;
    if (!socraticContext || !socraticContext.summary) {
        console.error("Socratic context not found. Redirecting.");
        window.location.hash = '/topics';
        return;
    }

    elements = {
        log: document.getElementById('socratic-log'),
        orb: document.getElementById('socratic-orb'),
        status: document.getElementById('socratic-status'),
        inputContainer: document.getElementById('socratic-input-container'),
        conclusionContainer: document.getElementById('socratic-conclusion-container'),
        form: document.getElementById('socratic-form'),
        input: document.getElementById('socratic-input'),
        submitBtn: document.querySelector('#socratic-form button'),
    };

    chatHistory = [];
    elements.form.addEventListener('submit', handleFormSubmit);

    // Kick off the conversation
    sendMessage();
}

export function destroy() {
    if (elements.form) {
        elements.form.removeEventListener('submit', handleFormSubmit);
    }
    // Clear context to prevent issues if user navigates back
    socraticContext = {};
}