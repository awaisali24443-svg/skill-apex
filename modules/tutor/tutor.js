import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;
let chatWindow, chatForm, chatInput, sendBtn, newTopicBtn;
let chatHistory = [];
let controller = null; // To abort fetch requests

// Simple markdown to HTML renderer
function renderMarkdown(text) {
    let html = text
        // Escape basic HTML to prevent injection
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });
    // Inline code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // New lines for display
    html = html.replace(/\n/g, '<br>');

    return html;
}

function appendMessage(role, content) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `chat-message ${role}-message`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = content;

    messageWrapper.appendChild(bubble);
    chatWindow.appendChild(messageWrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return bubble;
}

async function handleSendMessage(e) {
    e.preventDefault();
    const userInput = chatInput.value.trim();
    if (!userInput) return;

    controller = new AbortController();
    sendBtn.disabled = true;
    chatInput.value = '';

    // Add user message to history and UI
    appendMessage('user', userInput);
    chatHistory.push({ role: 'user', parts: [{ text: userInput }] });

    // Add AI placeholder message
    const aiBubble = appendMessage('ai', '<div class="thinking-indicator"><span></span><span></span><span></span></div>');

    try {
        const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                type: 'chat',
                payload: { history: chatHistory }
            })
        });

        if (!response.ok || !response.body) {
            const error = await response.json();
            throw new Error(error.message || 'Network response was not ok.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiResponseText = '';
        aiBubble.innerHTML = ''; // Clear thinking indicator

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            aiResponseText += decoder.decode(value, { stream: true });
            aiBubble.innerHTML = renderMarkdown(aiResponseText);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }

        // Add final AI response to history
        chatHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });

    } catch (error) {
        if (error.name !== 'AbortError') {
            aiBubble.innerHTML = `Sorry, I encountered an error: ${error.message}`;
            console.error('Error during chat:', error);
        }
    } finally {
        sendBtn.disabled = false;
        controller = null;
    }
}

function handleNewTopic() {
    if (controller) {
        controller.abort(); // Cancel any ongoing request
    }
    chatHistory = [];
    chatWindow.innerHTML = '';
    const initialMessage = 'Hi there! What would you like to learn about today?';
    appendMessage('ai', initialMessage);
    chatHistory.push({ role: 'user', parts: [{ text: 'Introduce yourself as an AI Tutor.' }] });
    chatHistory.push({ role: 'model', parts: [{ text: initialMessage }] });
}

export function init() {
    sceneManager = initModuleScene('.background-canvas', 'subtleParticles');
    
    chatWindow = document.getElementById('chat-window');
    chatForm = document.getElementById('chat-form');
    chatInput = document.getElementById('chat-input');
    sendBtn = document.getElementById('send-btn');
    newTopicBtn = document.getElementById('new-topic-btn');

    chatForm.addEventListener('submit', handleSendMessage);
    newTopicBtn.addEventListener('click', handleNewTopic);

    // Initial message
    handleNewTopic();
    
    // Signal that the module is fully loaded and ready to be displayed.
    document.dispatchEvent(new CustomEvent('moduleReady'));
}

export function cleanup() {
    if (controller) {
        controller.abort();
    }
    sceneManager = cleanupModuleScene(sceneManager);
    chatHistory = [];
}
