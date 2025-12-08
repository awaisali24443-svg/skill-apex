
import * as stateService from '../../services/stateService.js';
import * as historyService from '../../services/historyService.js';
import * as gamificationService from '../../services/gamificationService.js';
import { showToast } from '../../services/toastService.js';

const STATE = {
    IDLE: 'idle',
    CONNECTING: 'connecting',
    LISTENING: 'listening',
    SPEAKING: 'speaking',
    ERROR: 'error'
};

let currentState = STATE.IDLE;
let elements = {};
let socket = null;
let audioContext = null;
let mediaStream = null;
let inputProcessor = null;
let nextStartTime = 0;
let transcriptLog = [];
let sessionStartTime = 0;
let connectionTimeout = null;

// Audio processing constants
const SAMPLE_RATE = 24000; 
const INPUT_SAMPLE_RATE = 16000;

function updateUI(state) {
    currentState = state;
    const { orb, statusText, micBtn, placeholder } = elements;
    
    orb.classList.remove('listening', 'thinking', 'speaking');
    micBtn.classList.remove('active');
    
    switch (state) {
        case STATE.IDLE:
            statusText.textContent = "Tap to Start";
            placeholder.style.display = 'flex';
            break;
        case STATE.CONNECTING:
            statusText.textContent = "Establishing Neural Link...";
            orb.classList.add('thinking');
            placeholder.style.display = 'none';
            break;
        case STATE.LISTENING:
            statusText.textContent = "Listening...";
            orb.classList.add('listening');
            micBtn.classList.add('active');
            break;
        case STATE.SPEAKING:
            statusText.textContent = "AI Speaking...";
            orb.classList.add('speaking');
            break;
        case STATE.ERROR:
            statusText.textContent = "Connection Lost";
            break;
    }
}

function appendTranscript(text, sender) {
    if (!text) return;
    
    // Update existing if same sender and close in time, otherwise new bubble
    const lastEntry = transcriptLog[transcriptLog.length - 1];
    
    if (lastEntry && lastEntry.sender === sender && !lastEntry.final) {
        lastEntry.text += text;
        const bubble = document.querySelector('.transcription-entry:last-child');
        if (bubble) bubble.textContent = lastEntry.text;
    } else {
        const entry = { sender, text, final: false };
        transcriptLog.push(entry);
        
        const bubble = document.createElement('div');
        bubble.className = `transcription-entry ${sender} live`;
        bubble.textContent = text;
        elements.log.insertBefore(bubble, elements.log.firstChild);
    }
}

function finalizeLiveTranscription() {
    const lastEntry = transcriptLog[transcriptLog.length - 1];
    if (lastEntry) lastEntry.final = true;
    document.querySelectorAll('.transcription-entry.live').forEach(el => el.classList.remove('live'));
}

async function startConversation() {
    if (currentState !== STATE.IDLE) return;
    
    try {
        updateUI(STATE.CONNECTING);
        sessionStartTime = Date.now();
        transcriptLog = [];
        elements.log.innerHTML = '';
        
        // 1. Setup Audio Input
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: INPUT_SAMPLE_RATE } });
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
        
        // 2. Connect WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const systemInstruction = encodeURIComponent("You are a helpful and knowledgeable AI tutor. Keep answers concise and conversational.");
        socket = new WebSocket(`${protocol}//${host}?systemInstruction=${systemInstruction}`);
        
        socket.onopen = () => {
            console.log('WS Connected');
            updateUI(STATE.LISTENING);
            startAudioInput();
            
            // Send initial "Hello" triggers the model to speak first
            socket.send(JSON.stringify({ 
                type: 'audio_input', 
                payload: { data: '', mimeType: 'audio/pcm;rate=16000' } // Dummy packet to wake
            }));
        };
        
        socket.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'gemini_message') {
                const message = data.message;
                
                // Handle Audio
                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64Audio) {
                    playAudioChunk(base64Audio);
                    updateUI(STATE.SPEAKING);
                }
                
                // Handle Interruption
                if (message.serverContent?.interrupted) {
                    stopAudioOutput();
                    updateUI(STATE.LISTENING);
                }
                
                // Handle Turn Complete (Transcription)
                if (message.serverContent?.turnComplete) {
                    updateUI(STATE.LISTENING);
                }
            } else if (data.type === 'error') {
                showError(data.message);
                stopConversation();
            }
        };
        
        socket.onerror = (e) => {
            console.error(e);
            showError("Connection Failed");
            stopConversation();
        };
        
        socket.onclose = () => {
            if (currentState !== STATE.IDLE) stopConversation();
        };

        // Safety timeout
        connectionTimeout = setTimeout(() => {
            if (currentState === STATE.CONNECTING) {
                showError("Connection timed out.");
                stopConversation();
            }
        }, 10000);

    } catch (e) {
        showError("Could not access microphone: " + e.message);
        stopConversation();
    }
}

function startAudioInput() {
    if (!audioContext || !mediaStream) return;
    
    const source = audioContext.createMediaStreamSource(mediaStream);
    inputProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    
    inputProcessor.onaudioprocess = (e) => {
        if (currentState !== STATE.LISTENING && currentState !== STATE.SPEAKING) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Downsample/Convert to PCM 16-bit
        const pcmData = convertFloat32ToInt16(inputData);
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'audio_input',
                payload: {
                    data: base64Data,
                    mimeType: 'audio/pcm;rate=16000'
                }
            }));
        }
    };
    
    source.connect(inputProcessor);
    inputProcessor.connect(audioContext.destination);
}

function convertFloat32ToInt16(float32Array) {
    const l = float32Array.length;
    const int16Array = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
}

function playAudioChunk(base64Audio) {
    if (!audioContext) return;
    
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;
    
    const buffer = audioContext.createBuffer(1, float32.length, SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    
    const now = audioContext.currentTime;
    // Schedule seamlessly
    const startTime = Math.max(now, nextStartTime);
    source.start(startTime);
    nextStartTime = startTime + buffer.duration;
    
    source.onended = () => {
        if (audioContext && audioContext.currentTime >= nextStartTime) {
            // Silence detected, likely listening again
            if (currentState === STATE.SPEAKING) updateUI(STATE.LISTENING);
        }
    };
}

function stopAudioOutput() {
    // To 'stop' output in Web Audio, we generally have to disconnect/stop nodes.
    // Since we fire-and-forget buffer sources, we reset the time cursor.
    // A more robust implementation tracks active nodes to call .stop() on them.
    if (audioContext) {
        nextStartTime = audioContext.currentTime;
    }
}

function stopConversation() {
    if (currentState === STATE.IDLE) return;
    clearTimeout(connectionTimeout);
    finalizeLiveTranscription();

    // Save History
    if (transcriptLog.length > 0) {
        const durationSeconds = Math.round((Date.now() - sessionStartTime) / 1000);
        const xpGained = Math.min(50, Math.floor(durationSeconds / 2)); 
        historyService.addAuralSession({ transcript: transcriptLog, duration: durationSeconds, xpGained });
        gamificationService.incrementStat('auralMinutes', Math.ceil(durationSeconds / 60));
        if (xpGained > 0) showToast(`Session saved! +${xpGained} XP`, 'success');
    }

    // Cleanup
    if (socket) { 
        if (socket.readyState === WebSocket.OPEN) socket.close(); 
        socket = null; 
    }
    if (inputProcessor) { inputProcessor.disconnect(); inputProcessor = null; }
    if (mediaStream) { mediaStream.getTracks().forEach(track => track.stop()); mediaStream = null; }
    if (audioContext) { audioContext.close(); audioContext = null; }
    
    elements.log.innerHTML = '';
    updateUI(STATE.IDLE);
}

function showError(msg) {
    const errEl = document.getElementById('aural-error');
    if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
        setTimeout(() => { errEl.style.display = 'none'; }, 4000);
    }
    showToast(msg, 'error');
}

export function init() {
    elements = {
        micBtn: document.getElementById('aural-mic-btn'),
        orb: document.getElementById('orb'),
        statusText: document.getElementById('aural-status'),
        log: document.getElementById('transcription-log'),
        placeholder: document.getElementById('aural-placeholder')
    };
    
    elements.micBtn.onclick = () => {
        if (currentState === STATE.IDLE) startConversation();
        else stopConversation();
    };
}

export function destroy() {
    stopConversation();
}
