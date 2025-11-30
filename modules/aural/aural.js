


import * as stateService from '../../services/stateService.js';
import * as historyService from '../../services/historyService.js';
import { showToast } from '../../services/toastService.js';

// --- State Management ---
const STATE = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  THINKING: 'THINKING',
  SPEAKING: 'SPEAKING',
  ERROR: 'ERROR',
};

let currentState = STATE.IDLE;
let socket, mediaStream, inputAudioContext, outputAudioContext, connectionTimeout;
let audioWorkletNode;
let nextStartTime = 0;
let sources = new Set();
let liveTranscriptionElement = null;
let sessionStartTime = 0;
let transcriptLog = []; 
let elements = {};

const workletCode = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const float32Data = input[0];
      const int16Data = new Int16Array(float32Data.length);
      for (let i = 0; i < float32Data.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Data[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage(int16Data.buffer, [int16Data.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

// --- Audio Utilities ---
function encode(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function decode(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
async function decodeAudioData(data, ctx, sampleRate, numChannels) {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function updateUI(newState, message = '') {
    currentState = newState;
    elements.orb.className = 'orb'; 
    switch (currentState) {
        case STATE.IDLE:
            elements.status.textContent = 'Tap to Start';
            elements.micBtn.classList.remove('active');
            break;
        case STATE.CONNECTING:
            elements.status.textContent = 'Connecting...';
            break;
        case STATE.LISTENING:
            elements.status.textContent = 'Listening...';
            elements.orb.classList.add('listening');
            elements.micBtn.classList.add('active');
            break;
        case STATE.THINKING:
            elements.status.textContent = 'Thinking...';
            elements.orb.classList.add('thinking');
            break;
        case STATE.SPEAKING:
            elements.status.textContent = 'Speaking...';
            elements.orb.classList.add('speaking');
            break;
        case STATE.ERROR:
            elements.status.textContent = 'Error';
            elements.error.textContent = message;
            elements.error.style.display = 'block';
            elements.micBtn.classList.remove('active');
            break;
    }
}

function updateLiveTranscription(type, textChunk) {
    if (elements.placeholder) elements.placeholder.style.display = 'none';
    if (!liveTranscriptionElement || liveTranscriptionElement.dataset.type !== type) {
        if (liveTranscriptionElement) {
            liveTranscriptionElement.classList.remove('live');
            const previousText = liveTranscriptionElement.textContent;
            if (previousText.trim()) {
                transcriptLog.push({ sender: liveTranscriptionElement.dataset.type, text: previousText });
            }
        }
        liveTranscriptionElement = document.createElement('div');
        liveTranscriptionElement.className = `transcription-entry live ${type}`;
        liveTranscriptionElement.dataset.type = type;
        elements.log.prepend(liveTranscriptionElement);
    }
    liveTranscriptionElement.textContent += textChunk;
}

function finalizeLiveTranscription() {
    if (liveTranscriptionElement) {
        liveTranscriptionElement.classList.remove('live');
        const text = liveTranscriptionElement.textContent;
        if (text.trim()) {
            transcriptLog.push({ sender: liveTranscriptionElement.dataset.type, text: text });
        }
        liveTranscriptionElement = null;
    }
}

async function startConversation() {
    if (currentState !== STATE.IDLE && currentState !== STATE.ERROR) return;
    
    // --- CRITICAL FIX FOR MOBILE SAFARI ---
    // Initialize and resume contexts synchronously within the user gesture (click)
    if (!inputAudioContext) inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    if (inputAudioContext.state === 'suspended') await inputAudioContext.resume();

    if (!outputAudioContext) outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    if (outputAudioContext.state === 'suspended') await outputAudioContext.resume();
    // --------------------------------------

    transcriptLog = [];
    sessionStartTime = Date.now();
    elements.log.innerHTML = ''; 
    if(elements.placeholder) elements.placeholder.style.display = 'flex'; 

    updateUI(STATE.CONNECTING);
    elements.error.style.display = 'none';

    connectionTimeout = setTimeout(() => {
        if (currentState === STATE.CONNECTING) {
            updateUI(STATE.ERROR, 'Connection timed out.');
            stopConversation();
        }
    }, 10000); 

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        await inputAudioContext.audioWorklet.addModule(workletUrl);
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        
        // --- CONTEXT INJECTION (APEXCORE AURAL MODE) ---
        const userContext = historyService.getLastContext();
        const baseInstruction = `You are ApexCore's Aural Tutor.
        ROLE: A warm, human-like mentor.
        RULES:
        1. Use spoken-style conversation. Use analogies, storytelling, and mental imagery.
        2. DO NOT use bullet points or lists.
        3. Be encouraging and concise.
        
        USER CONTEXT: ${userContext}`;
        
        const socketUrl = `${protocol}//${window.location.host}/?systemInstruction=${encodeURIComponent(baseInstruction)}`;
        socket = new WebSocket(socketUrl);

        socket.onopen = () => {
            clearTimeout(connectionTimeout);
            updateUI(STATE.LISTENING);
            const source = inputAudioContext.createMediaStreamSource(mediaStream);
            audioWorkletNode = new AudioWorkletNode(inputAudioContext, 'pcm-processor');
            audioWorkletNode.port.onmessage = (event) => {
                if (socket.readyState === WebSocket.OPEN) {
                    const pcmBuffer = event.data;
                    const base64Audio = encode(new Uint8Array(pcmBuffer));
                    socket.send(JSON.stringify({ type: 'audio_input', payload: { data: base64Audio, mimeType: 'audio/pcm;rate=16000' } }));
                }
            };
            source.connect(audioWorkletNode);
            audioWorkletNode.connect(inputAudioContext.destination);
        };

        socket.onmessage = async (event) => {
            try {
                const serverMessage = JSON.parse(event.data);
                if (serverMessage.type === 'error') { updateUI(STATE.ERROR, serverMessage.message); return; }
                const geminiMessage = serverMessage.message;
                if (!geminiMessage) return;

                if (geminiMessage.serverContent?.interrupted) {
                    sources.forEach(source => source.stop());
                    sources.clear();
                    nextStartTime = 0;
                    finalizeLiveTranscription();
                }

                const inputTranscription = geminiMessage.serverContent?.inputTranscription?.text;
                if (inputTranscription) {
                    if (currentState === STATE.LISTENING) updateUI(STATE.THINKING);
                    updateLiveTranscription('user', inputTranscription);
                }

                const outputTranscription = geminiMessage.serverContent?.outputTranscription?.text;
                if (outputTranscription) {
                    if (liveTranscriptionElement && liveTranscriptionElement.dataset.type === 'user') finalizeLiveTranscription();
                    updateLiveTranscription('model', outputTranscription);
                }
                
                const audioData = geminiMessage.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData) {
                    if (currentState !== STATE.SPEAKING) updateUI(STATE.SPEAKING);
                    if (liveTranscriptionElement && liveTranscriptionElement.dataset.type === 'user') finalizeLiveTranscription();

                    const decoded = decode(audioData);
                    const audioBuffer = await decodeAudioData(decoded, outputAudioContext, 24000, 1);
                    
                    nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                    const source = outputAudioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputAudioContext.destination);
                    source.addEventListener('ended', () => sources.delete(source));
                    source.start(nextStartTime);
                    nextStartTime += audioBuffer.duration;
                    sources.add(source);
                }
                
                if(geminiMessage.serverContent?.turnComplete) {
                    finalizeLiveTranscription();
                    const checkPlayback = () => {
                        if (!outputAudioContext || outputAudioContext.state === 'closed' || outputAudioContext.currentTime + 0.1 >= nextStartTime) {
                             if (currentState !== STATE.IDLE && currentState !== STATE.ERROR) updateUI(STATE.LISTENING);
                        } else { setTimeout(checkPlayback, 100); }
                    };
                    checkPlayback();
                }
            } catch (e) { console.error(e); updateUI(STATE.ERROR, 'Error processing message'); }
        };
        
        socket.onerror = (err) => { finalizeLiveTranscription(); updateUI(STATE.ERROR, `Connection error.`); };
        socket.onclose = () => { finalizeLiveTranscription(); stopConversation(); };

    } catch (err) {
        clearTimeout(connectionTimeout);
        updateUI(STATE.ERROR, `Could not start: ${err.message}`);
    }
}

function stopConversation() {
    if (currentState === STATE.IDLE) return;
    clearTimeout(connectionTimeout);
    finalizeLiveTranscription();

    if (transcriptLog.length > 0) {
        const duration = Math.round((Date.now() - sessionStartTime) / 1000);
        const xpGained = Math.min(50, Math.floor(duration / 2)); 
        historyService.addAuralSession({ transcript: transcriptLog, duration, xpGained });
        if (xpGained > 0) showToast(`Session saved! +${xpGained} XP`, 'success');
    }

    if (socket) { 
        if (socket.readyState === WebSocket.OPEN) socket.close(); 
        socket = null; 
    }
    if (audioWorkletNode) { audioWorkletNode.disconnect(); audioWorkletNode = null; }
    if (mediaStream) { mediaStream.getTracks().forEach(track => track.stop()); mediaStream = null; }
    // Do not close audio contexts here; reuse them or they will need new user gesture
    if (outputAudioContext) { sources.forEach(s => s.stop()); sources.clear(); }
    
    if (elements.log) elements.log.innerHTML = '';
    if (elements.placeholder) elements.placeholder.style.display = 'flex';
    updateUI(STATE.IDLE);
}

function handleMicClick() {
    if (currentState === STATE.IDLE || currentState === STATE.ERROR) startConversation();
    else stopConversation();
}

export function init() {
    elements = {
        log: document.getElementById('transcription-log'),
        placeholder: document.getElementById('aural-placeholder'),
        orb: document.getElementById('orb'),
        status: document.getElementById('aural-status'),
        micBtn: document.getElementById('aural-mic-btn'),
        error: document.getElementById('aural-error'),
        headerControls: document.getElementById('aural-header-controls'),
    };
    const { navigationContext } = stateService.getState();
    if (navigationContext.auralContext?.from) {
        const backBtn = document.createElement('a');
        backBtn.href = `#/${navigationContext.auralContext.from}`;
        backBtn.className = 'btn';
        backBtn.innerHTML = `<svg class="icon" width="18" height="18" viewBox="0 0 24 24"><use href="assets/icons/feather-sprite.svg#arrow-left"/></svg><span>Back</span>`;
        elements.headerControls.appendChild(backBtn);
    }
    elements.micBtn.addEventListener('click', handleMicClick);
    updateUI(STATE.IDLE);
}

export function destroy() {
    stopConversation();
    if(elements.micBtn) elements.micBtn.removeEventListener('click', handleMicClick);
}
