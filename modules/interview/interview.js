
import * as apiService from '../../services/apiService.js';
import * as stateService from '../../services/stateService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as soundService from '../../services/soundService.js';
import { showToast } from '../../services/toastService.js';

let elements = {};
let conversationHistory = [];
let currentTopic = null;
let isProcessing = false;

function addMessage(role, text, isTyping = false) {
    // Remove existing typing indicator if exists
    const existingTyping = document.querySelector('.chat-msg.ai.typing');
    if (existingTyping) existingTyping.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${role} ${isTyping ? 'typing' : ''}`;
    
    let icon = role === 'ai' ? '<svg class="icon"><use href="assets/icons/feather-sprite.svg#cpu"/></svg>' : '<svg class="icon"><use href="assets/icons/feather-sprite.svg#user"/></svg>';
    
    let contentHtml = text;
    if (isTyping) {
        contentHtml = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
    }

    msgDiv.innerHTML = `
        <div class="msg-avatar">${icon}</div>
        <div class="msg-content">${contentHtml}</div>
    `;
    
    elements.history.appendChild(msgDiv);
    elements.history.scrollTop = elements.history.scrollHeight;
    
    if (!isTyping) {
        soundService.playSound(role === 'user' ? 'click' : 'hover');
    }
}

async function processTurn(userText) {
    if (isProcessing) return;
    isProcessing = true;
    
    elements.input.disabled = true;
    elements.sendBtn.disabled = true;
    elements.status.textContent = "Analyzing Response...";

    if (userText) {
        addMessage('user', userText);
        conversationHistory.push({ role: 'user', text: userText });
    }

    // Show typing
    addMessage('ai', '', true);

    try {
        const response = await apiService.processInterviewStep(conversationHistory, currentTopic);
        
        // Remove typing indicator
        const typingEl = document.querySelector('.chat-msg.ai.typing');
        if (typingEl) typingEl.remove();

        if (response && response.message) {
            addMessage('ai', response.message);
            conversationHistory.push({ role: 'model', text: response.message });

            if (response.status === 'complete') {
                handleCompletion(response);
            } else {
                // Continue interview
                if (response.topic && !currentTopic) currentTopic = response.topic; // AI inferred topic
                elements.input.disabled = false;
                elements.sendBtn.disabled = false;
                elements.input.focus();
                elements.status.textContent = "Awaiting Input...";
            }
        } else {
            throw new Error("Invalid response from Neural Core");
        }

    } catch (e) {
        console.error(e);
        const typingEl = document.querySelector('.chat-msg.ai.typing');
        if (typingEl) typingEl.remove();
        addMessage('ai', "Neural Link Unstable. Please retry.");
        elements.input.disabled = false;
        elements.sendBtn.disabled = false;
    } finally {
        isProcessing = false;
    }
}

async function handleCompletion(result) {
    elements.status.textContent = "Calibration Complete";
    soundService.playSound('achievement');
    
    // Slight delay for reading
    setTimeout(async () => {
        const level = result.recommendedLevel || 1;
        const topic = result.topic || currentTopic || "General Knowledge";
        
        showToast(`Skill Assessed: Level ${level}`, 'success');
        
        const journey = await learningPathService.startOrGetJourney(topic, {
            totalLevels: 100, // Standard
            description: "Custom path generated via Neural Calibration.",
            currentLevel: level // JUMP START
        });
        
        // Navigate
        stateService.setNavigationContext({ 
            topic: journey.goal, 
            level: level, 
            journeyId: journey.id 
        });
        window.location.hash = '#/level';
        
    }, 3000);
}

export function init() {
    elements = {
        history: document.getElementById('chat-history'),
        input: document.getElementById('user-response-input'),
        sendBtn: document.getElementById('send-response-btn'),
        form: document.getElementById('interview-form'),
        status: document.getElementById('interview-status'),
        exitBtn: document.getElementById('exit-interview-btn')
    };

    // Clear placeholder
    elements.history.innerHTML = '';

    const context = stateService.getState().navigationContext || {};
    currentTopic = context.interviewTopic || null;

    // Start Conversation
    processTurn(null); // Initial AI turn

    elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = elements.input.value.trim();
        if (text) {
            elements.input.value = '';
            processTurn(text);
        }
    });

    elements.exitBtn.addEventListener('click', () => {
        window.location.hash = '#/topics';
    });
}

export function destroy() {
    conversationHistory = [];
}
